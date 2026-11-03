// Read-only check against a deployed HTTPS app, using a disposable iPad-WebKit profile.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { webkit, devices } = require("playwright");

const baseUrl = new URL(process.env.BASE_URL || "https://lerndeck.jujies.app/");
const reportPath = path.resolve(process.env.REPORT_PATH || "artifacts/pwa-offline-persistence/result.json");
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");

async function readPublicFile(relativePath) {
  const response = await fetch(new URL(relativePath, baseUrl));
  assert.equal(response.status, 200, `Public file: ${relativePath}`);
  return response.text();
}

async function main() {
  assert.equal(baseUrl.protocol, "https:", "The app intentionally unregisters workers on HTTP.");
  const sw = await readPublicFile("sw.js");
  const html = await readPublicFile("index.html");
  const cacheName = sw.match(/const CACHE_NAME = "([^"]+)"/)?.[1];
  const shellManifest = sw.match(/const APP_SHELL_URLS = (\[[\s\S]*?\]);/)?.[1];
  const appPath = html.match(/src="\.\/([^"\s]*app\.js\?[^"\s]+)"/)?.[1];
  assert(cacheName && shellManifest && appPath, "Expected the deployed shell manifest and versioned app script.");
  const shellPaths = JSON.parse(shellManifest.replace(/,\s*\]$/, "]"));
  const expectedAppHash = hash(await readPublicFile(appPath));
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-offline-webkit-"));
  const options = { headless: true, ...devices["iPad (gen 7)"] };
  const report = {
    checkedAt: new Date().toISOString(), baseUrl: baseUrl.href,
    playwright: require("playwright/package.json").version,
    cacheName, appPath, shellFileCount: shellPaths.length, expectedAppHash, phases: [], passed: false,
  };
  let context;

  async function checkPage(page, phase, response) {
    const stored = await page.evaluate(async ({ cacheName, appPath, shellPaths }) => {
      const cache = await caches.open(cacheName);
      const app = await cache.match(`/${appPath}`);
      return {
        caches: await caches.keys(), entries: (await cache.keys()).length,
        missingShellFiles: (await Promise.all(shellPaths.map(async (url) => (
          await cache.match(url) ? null : url
        )))).filter(Boolean),
        appText: app ? await app.text() : null,
        marker: localStorage.getItem("lerndeck-offline-verification-marker"),
        controlled: Boolean(navigator.serviceWorker.controller),
        inputShuffleLoaded: typeof resetInputLearningState === "function"
          && resetInputLearningState.toString().includes("previousCardId"),
      };
    }, { cacheName, appPath, shellPaths });
    const cachedAppHash = stored.appText === null ? null : hash(stored.appText);
    delete stored.appText;
    const result = {
      phase, status: response?.status(), fromServiceWorker: response?.fromServiceWorker(),
      ...stored, cachedAppHash,
    };
    report.phases.push(result);
    assert.equal(stored.marker, "preserved", `${phase}: local storage`);
    assert.equal(stored.controlled, true, `${phase}: controlled page`);
    assert.equal(stored.inputShuffleLoaded, true, `${phase}: updated input logic`);
    assert.deepEqual(stored.missingShellFiles, [], `${phase}: complete app shell`);
    assert.equal(cachedAppHash, expectedAppHash, `${phase}: exact deployed script in cache`);
    if (phase.startsWith("offline")) {
      assert.equal(result.status, 200, `${phase}: document loaded`);
      assert.equal(result.fromServiceWorker, true, `${phase}: served by worker`);
    }
    console.log(JSON.stringify(result));
  }

  try {
    context = await webkit.launchPersistentContext(profile, options);
    report.browser = context.browser().version();
    let page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "load" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Wait for installation and control, not merely for creation of an empty cache.
    await page.waitForFunction(async ({ cacheName, appPath }) => {
      const cache = await caches.open(cacheName);
      return Boolean(navigator.serviceWorker.controller && await cache.match(`/${appPath}`));
    }, { cacheName, appPath }, { timeout: 30000 });
    await page.evaluate(() => localStorage.setItem("lerndeck-offline-verification-marker", "preserved"));
    await checkPage(page, "online-cached");

    await context.setOffline(true);
    await checkPage(page, "offline-reload", await page.reload({ waitUntil: "load" }));
    await context.close();

    context = await webkit.launchPersistentContext(profile, { ...options, offline: true });
    page = await context.newPage();
    await checkPage(page, "offline-after-browser-restart", await page.goto(baseUrl.href, { waitUntil: "load" }));
    await context.close();

    context = await webkit.launchPersistentContext(profile, options);
    page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "load" });
    await checkPage(page, "online-again");
    report.passed = true;
  } catch (error) {
    report.error = error.message;
    throw error;
  } finally {
    await context?.close();
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await fs.rm(profile, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
