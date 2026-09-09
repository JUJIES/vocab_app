const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SetService } = require("../lib/set-service");
const { TeacherService } = require("../lib/teacher-service");

async function waitForHealth(origin) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      if ((await fetch(`${origin}/health`)).ok) return;
    } catch (_error) {
      // The isolated server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Testserver wurde nicht rechtzeitig bereit.");
}

async function login(origin, credentials) {
  const response = await fetch(`${origin}/api/teacher/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacherId: credentials.id, password: credentials.initialPassword }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

test("admins can inspect and edit other teachers' sets without taking ownership", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "lerndeck-admin-"));
  const seedPath = path.join(__dirname, "..", "data", "teachers.seed.json");
  const teacherService = new TeacherService({ dataDir, seedPath });
  const credentials = await teacherService.provisionInitialPasswords();
  const julius = credentials.find((entry) => entry.id === "julius");
  const aksana = credentials.find((entry) => entry.id === "aksana");
  const setService = new SetService({ dataDir });
  const juliusSet = await setService.createSet("julius", {
    title: "Julius Set",
    cards: [{ front: "Haus", back: "house" }],
  });
  const aksanaSet = await setService.createSet("aksana", {
    title: "Aksana Set",
    cards: [{ front: "Hund", back: "dog" }],
  });

  const port = 6700 + Math.floor(Math.random() * 300);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATA_DIR: dataDir, HOST: "127.0.0.1", PORT: String(port), HTTPS_PORT: "0" },
    stdio: "ignore",
  });
  context.after(async () => {
    child.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  });
  await waitForHealth(origin);

  const juliusCookie = await login(origin, julius);
  const adminIndex = await fetch(`${origin}/api/sets`, { headers: { Cookie: juliusCookie } });
  assert.equal(adminIndex.status, 200);
  const adminData = await adminIndex.json();
  assert.equal(adminData.teacher.role, "admin");
  assert.ok(adminData.sets.some((entry) => entry.id === juliusSet.id));
  assert.ok(adminData.sets.some((entry) => entry.id === aksanaSet.id));
  const managedAksanaSet = adminData.sets.find((entry) => entry.id === aksanaSet.id);
  assert.equal(managedAksanaSet.ownerDisplayName, "Aksana");
  assert.equal(managedAksanaSet.managedByAdmin, true);
  assert.equal(managedAksanaSet.editable, true);
  assert.equal(managedAksanaSet.deletable, false);

  const edited = await fetch(`${origin}/api/teacher/sets/${aksanaSet.id}`, {
    method: "PUT",
    headers: { Cookie: juliusCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Von Julius geprüft", cards: aksanaSet.cards }),
  });
  assert.equal(edited.status, 200);
  assert.equal((await setService.getOwnedSet("aksana", aksanaSet.id)).title, "Von Julius geprüft");
  assert.equal(await setService.getOwnedSet("julius", aksanaSet.id), null);

  const forbiddenDelete = await fetch(`${origin}/api/teacher/sets/${aksanaSet.id}`, {
    method: "DELETE",
    headers: { Cookie: juliusCookie },
  });
  assert.equal(forbiddenDelete.status, 404);

  const aksanaCookie = await login(origin, aksana);
  const teacherIndex = await fetch(`${origin}/api/sets`, { headers: { Cookie: aksanaCookie } });
  const teacherData = await teacherIndex.json();
  assert.deepEqual(teacherData.sets.map((entry) => entry.id), [aksanaSet.id]);
  assert.equal(teacherData.sets.some((entry) => entry.id === juliusSet.id), false);
});
