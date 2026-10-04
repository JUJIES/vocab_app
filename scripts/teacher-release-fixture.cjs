const base = require("playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const release = fs.readFileSync(path.resolve(__dirname, "../teacher-whats-new.js"), "utf8").match(/const RELEASE_ID = "([^"]+)"/)[1];
// Existing feature flows represent returning teachers; first-visit behavior has its own spec.
const test = base.test.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(releaseId => {
      for (const id of ["julius", "aksana", "jessi-s", "jessi-b", "joerg", "matti"]) {
        try { localStorage.setItem("lerndeck-whats-new-v1:" + id, releaseId); } catch { /* Storage-denial tests keep their own handling. */ }
      }
    }, release);
    await use(page);
  },
});
module.exports = { ...base, test };
