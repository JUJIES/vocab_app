const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

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

test("a wrong tablet selection can be changed after cooldown without clearing failures", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "lerndeck-tablet-switch-"));
  const port = 7200 + Math.floor(Math.random() * 300);
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

  async function post(pathname, body, cookie = "") {
    return fetch(`${origin}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  }

  assert.equal((await post("/api/tablets/blau-1/register", { pin: "1234" })).status, 200);
  assert.equal((await post("/api/tablets/blau-2/register", { pin: "5678" })).status, 200);

  const firstSession = await fetch(`${origin}/api/access-session`);
  const cookie = firstSession.headers.get("set-cookie").split(";")[0];
  const textPin = await post("/api/tablets/blau-1/verify-pin", { pin: "passwort" }, cookie);
  assert.equal(textPin.status, 400);
  assert.equal((await textPin.json()).accessSession.isBound, false);
  const wrongPin = await post("/api/tablets/blau-1/verify-pin", { pin: "5678" }, cookie);
  assert.equal(wrongPin.status, 429);
  const failedSession = (await wrongPin.json()).accessSession;
  assert.equal(failedSession.tabletId, "blau-1");
  assert.equal(failedSession.failureCount, 1);

  const earlySwitch = await post("/api/tablets/switch-selection", {}, cookie);
  assert.equal(earlySwitch.status, 429);
  assert.equal((await earlySwitch.json()).accessSession.tabletId, "blau-1");

  const remainingMs = Date.parse(failedSession.lockedUntil) - Date.now();
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs + 100));

  const switchResponse = await post("/api/tablets/switch-selection", {}, cookie);
  assert.equal(switchResponse.status, 200);
  const switchedSession = (await switchResponse.json()).accessSession;
  assert.equal(switchedSession.isBound, false);
  assert.equal(switchedSession.failureCount, 1);

  const correctTablet = await post("/api/tablets/blau-2/verify-pin", { pin: "5678" }, cookie);
  assert.equal(correctTablet.status, 200);
  assert.equal((await correctTablet.json()).tablet.id, "blau-2");
});
