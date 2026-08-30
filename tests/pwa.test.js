const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = path.join(__dirname, "..");

test("student and teacher install as distinct web apps with the shared icon family", () => {
  const studentManifest = readJson("manifest.webmanifest");
  const teacherManifest = readJson("teacher.webmanifest");

  assert.equal(studentManifest.id, "/");
  assert.equal(studentManifest.start_url, "/");
  assert.equal(teacherManifest.id, "/teacher");
  assert.equal(teacherManifest.start_url, "/teacher");
  assert.equal(studentManifest.display, "standalone");
  assert.equal(teacherManifest.display, "standalone");
  assert.notEqual(studentManifest.id, teacherManifest.id);

  for (const manifest of [studentManifest, teacherManifest]) {
    const iconsBySize = new Map(manifest.icons.map((icon) => [icon.sizes, icon]));
    assert.equal(iconsBySize.get("192x192")?.purpose, "any");
    assert.equal(iconsBySize.get("512x512")?.purpose, "maskable");
    assert.equal(iconsBySize.get("1024x1024")?.purpose, "any");
    assert.equal(manifest.icons.every((icon) => icon.src.includes("?v=2026-08-30-app-icon-v1")), true);
  }
});

test("PWA metadata points each surface at the correct manifest and opaque icons", () => {
  const studentHtml = readText("index.html");
  const teacherHtml = readText("teacher.html");
  const serviceWorker = readText("sw.js");

  assert.match(studentHtml, /manifest\.webmanifest\?v=/);
  assert.doesNotMatch(studentHtml, /teacher\.webmanifest/);
  assert.match(teacherHtml, /teacher\.webmanifest\?v=/);
  assert.match(studentHtml, /apple-touch-icon-167\.png/);
  assert.match(teacherHtml, /apple-touch-icon-167\.png/);
  assert.match(serviceWorker, /"\/teacher\.html"/);
  assert.match(serviceWorker, /url\.pathname === "\/teacher"/);

  const expectedPngs = new Map([
    ["icons/favicon-32.png", 32],
    ["icons/apple-touch-icon-152.png", 152],
    ["icons/apple-touch-icon-167.png", 167],
    ["icons/apple-touch-icon.png", 180],
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/icon-512-maskable.png", 512],
    ["icons/relution-webclip-512.png", 512],
    ["icons/icon-1024.png", 1024],
  ]);

  for (const [filePath, expectedSize] of expectedPngs) {
    const image = fs.readFileSync(path.join(ROOT_DIR, filePath));
    assert.equal(image.toString("ascii", 1, 4), "PNG", `${filePath} ist keine PNG-Datei`);
    assert.equal(image.readUInt32BE(16), expectedSize, `${filePath} hat die falsche Breite`);
    assert.equal(image.readUInt32BE(20), expectedSize, `${filePath} hat die falsche Höhe`);
    assert.notEqual(image[25], 4, `${filePath} darf keinen Alpha-Kanal verwenden`);
    assert.notEqual(image[25], 6, `${filePath} darf keinen Alpha-Kanal verwenden`);
  }
});

test("PWA control files bypass intermediary caches and service worker updates bypass HTTP caches", () => {
  const pwaScript = readText("pwa.js");
  const serverSource = readText("server.js");

  assert.match(pwaScript, /updateViaCache:\s*"none"/);
  assert.match(pwaScript, /registration\.update\(\)/);
  assert.match(serverSource, /"\/sw\.js"/);
  assert.match(serverSource, /no-store, no-cache, must-revalidate/);
});

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}
