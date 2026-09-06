const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { TeacherService } = require("../lib/teacher-service");

async function waitForHealth(origin) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return;
    } catch (_error) {
      // Server startup is intentionally polled with a short bounded retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Testserver wurde nicht rechtzeitig bereit.");
}

test("Tafelraum embed has an explicit frame policy and isolated secure session cookie", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "lerndeck-tafelraum-"));
  const teacherService = new TeacherService({
    dataDir,
    seedPath: path.join(__dirname, "..", "data", "teachers.seed.json"),
  });
  const credentials = (await teacherService.provisionInitialPasswords())
    .find((entry) => entry.username === "julius");
  assert.ok(credentials);

  const port = 6200 + Math.floor(Math.random() * 500);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      HTTPS_PORT: "0",
      TAFELRAUM_EMBED_ORIGINS: "https://tafelraum.example",
    },
    stdio: "ignore",
  });
  context.after(async () => {
    child.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  });
  await waitForHealth(origin);

  const normalPage = await fetch(`${origin}/teacher`);
  assert.equal(normalPage.headers.get("content-security-policy"), "frame-ancestors 'none'");

  const embeddedPage = await fetch(`${origin}/teacher?embed=tafelraum`);
  assert.equal(embeddedPage.headers.get("content-security-policy"), "frame-ancestors https://tafelraum.example");

  const login = await fetch(`${origin}/api/teacher/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-Proto": "https",
      "X-Lerndeck-Embed": "tafelraum",
    },
    body: JSON.stringify({ teacherId: credentials.id, password: credentials.initialPassword }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^lerndeck_teacher_embed_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=None/i);
  assert.match(cookie, /Partitioned/i);
});
