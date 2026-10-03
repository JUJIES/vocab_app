const { test, expect } = require("playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const { TeacherService } = require("../lib/teacher-service");
const { SetService } = require("../lib/set-service");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4030";
const DATA_DIR = process.env.WORKSPACE_TEST_DATA;
test.skip(!DATA_DIR || !/^http:\/\/127\.0\.0\.1:/.test(BASE_URL), "Needs an isolated local server and WORKSPACE_TEST_DATA.");
test.use({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 }, locale: "de-DE", serviceWorkers: "block" });
const PASSWORD = "Workspace-Test2026!";
const prefix = "BL3";
let unit, shops, rooms;
const sides = { sidePreset: "languages", sourceLabel: "Englisch", targetLabel: "Deutsch", sourceLanguage: "en", targetLanguage: "de" };
test.beforeAll(async () => {
  const teachers = new TeacherService({ dataDir: DATA_DIR, seedPath: path.resolve("data/teachers.seed.json") });
  for (const credential of await teachers.provisionInitialPasswords()) {
    await teachers.changePassword({ teacherId: credential.id, currentPassword: credential.initialPassword, newPassword: PASSWORD });
  }
  const sets = new SetService({ dataDir: DATA_DIR });
  for (const entry of await sets.listOwnedSets("aksana")) {
    if (entry.title.startsWith("Workspace ") || entry.title.startsWith("BL3 ·")) await sets.deleteOwnedSet("aksana", entry.id);
  }
  for (const entry of await sets.listUnits("aksana")) {
    if (entry.name.startsWith("Workspace ") || entry.name.startsWith("BL3 ·")) await sets.deleteUnit("aksana", entry.id);
  }
  unit = await sets.saveUnit("aksana", { name: prefix + " · Unit 1" });
  shops = await sets.createSet("aksana", { ...sides, title: prefix + " · Shops", unitId: unit.id,
    cards: [{ front: "a shop", back: "ein Geschäft" }, { front: "to buy", back: "kaufen" }, { front: "a price", back: "ein Preis" }] });
  rooms = await sets.createSet("aksana", { ...sides, title: prefix + " · Room things", unitId: unit.id, cards: [{ front: "a shelf", back: "ein Regal" }] });
  for (let i = 1; i <= 28; i++) await sets.createSet("aksana", { ...sides, title: `${prefix} · Station ${i}`, unitId: unit.id,
    cards: Array.from({ length: 18 }, (_, n) => ({ front: `word ${i}-${n}`, back: `Wort ${i}-${n}` })) });
  await fs.mkdir("artifacts/teacher-workspace", { recursive: true });
});
test.afterEach(async () => {
  const service = new SetService({ dataDir: DATA_DIR });
  for (const original of [shops, rooms]) {
    const current = await service.getOwnedSet("aksana", original.id);
    if (current?.title !== original.title) await service.updateSet("aksana", original.id, { ...current, title: original.title });
    if (current?.unitId !== original.unitId) await service.moveSet("aksana", original.id, original.unitId);
  }
});
async function login(page, teacherId = "aksana") {
  const response = await page.request.post("/api/teacher/session", { data: { teacherId, password: PASSWORD } });
  expect(response.ok()).toBeTruthy();
  await page.goto("/teacher");
  await expect(page.locator("#teacher-workspace")).toBeVisible();
}
async function open(page, set) { await page.locator(`[data-open-set="${set.id}"]`).click(); await expect(page.locator("#set-title-input")).toHaveValue(set.title); }

test("tablet connections require admin rights while device sessions keep their own access", async ({ page, playwright }) => {
  let directoryRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/tablets") directoryRequests++; });
  await login(page); await open(page, shops);
  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.locator('[data-teacher-tab="tablets"]')).toBeHidden();
  await expect(page.locator("#workspace-tablet-usage")).toBeHidden();
  expect(directoryRequests).toBe(0);
  const admin = await playwright.request.newContext({ baseURL: BASE_URL });
  const pupil = await playwright.request.newContext({ baseURL: BASE_URL });
  const tabletPath = "/api/tablets/blau-6";
  try {
    expect((await pupil.get("/api/tablets")).status()).toBe(401);
    expect((await admin.post("/api/teacher/session", { data: { teacherId: "julius", password: PASSWORD } })).ok()).toBeTruthy();
    expect((await admin.post(tabletPath + "/decouple")).ok()).toBeTruthy();
    const registration = await pupil.post(tabletPath + "/register", { data: { pin: "6472" } });
    expect(registration.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await registration.json()).session.token}` };
    expect((await pupil.post(tabletPath + "/subscriptions", { headers, data: { setPath: shops.path } })).ok()).toBeTruthy();
    const before = (await (await admin.get(tabletPath)).json()).tablet;
    for (const [method, suffix, data] of [
      ["get", "", undefined], ["delete", `/subscriptions?set=${encodeURIComponent(shops.path)}`, undefined],
      ["post", "/reset-access-session", undefined], ["post", "/reset-pin", { pin: "5831" }], ["post", "/decouple", undefined],
    ]) expect((await page.request[method](tabletPath + suffix, { data })).status()).toBe(403);
    expect((await page.request.get("/api/tablets")).status()).toBe(403);
    expect((await (await admin.get(tabletPath)).json()).tablet).toEqual(before);
    const teacherIndex = await (await page.request.get("/api/sets")).json();
    expect(teacherIndex.sets.every(set => !Object.hasOwn(set, "tablets"))).toBeTruthy();
    const adminIndex = await (await admin.get("/api/sets")).json();
    expect(adminIndex.sets.find(set => set.id === shops.id).tablets.map(tablet => tablet.id)).toContain("blau-6");
    // The valid pupil token wins even if this browser also has a regular teacher cookie.
    expect((await page.request.get(tabletPath, { headers })).ok()).toBeTruthy();
    expect((await page.request.delete(tabletPath + `/subscriptions?set=${encodeURIComponent(shops.path)}`, { headers })).ok()).toBeTruthy();
    expect((await pupil.get(tabletPath + "/subscriptions", { headers })).ok()).toBeTruthy();
    expect((await pupil.get("/api/tablets/blau-5", { headers })).status()).toBe(403);
    expect((await admin.post(tabletPath + "/reset-access-session")).ok()).toBeTruthy();
    expect((await admin.post(tabletPath + "/reset-pin", { data: { pin: "5831" } })).ok()).toBeTruthy();
    expect((await pupil.get(tabletPath, { headers })).status()).toBe(401);
    const verification = await pupil.post(tabletPath + "/verify-pin", { data: { pin: "5831" } });
    expect(verification.ok()).toBeTruthy();
    const newHeaders = { Authorization: `Bearer ${(await verification.json()).session.token}` };
    expect((await pupil.post(tabletPath + "/subscriptions", { headers: newHeaders, data: { setPath: shops.path } })).ok()).toBeTruthy();
    expect((await admin.delete(tabletPath + `/subscriptions?set=${encodeURIComponent(shops.path)}`)).ok()).toBeTruthy();
    expect((await (await pupil.get(tabletPath + "/subscriptions", { headers: newHeaders })).json()).subscriptions).toHaveLength(0);
  } finally {
    await admin.post(tabletPath + "/decouple");
    await admin.dispose(); await pupil.dispose();
  }
});

test("admin tabs work with keyboard and disappear when switching to a regular teacher", async ({ page }) => {
  await login(page, "julius");
  const setsTab = page.getByRole("tab", { name: "Lernsets", exact: true });
  const tabletsTab = page.getByRole("tab", { name: "Tablets", exact: true });
  await setsTab.focus(); await setsTab.press("ArrowRight");
  await expect(tabletsTab).toBeFocused(); await expect(tabletsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
  await tabletsTab.press("Home"); await expect(setsTab).toBeFocused();
  await open(page, (await (await page.request.get("/api/sets")).json()).sets.find(set => set.status !== "draft" && set.ownerTeacherId === "julius"));
  await expect(page.locator("#workspace-tablet-usage")).toBeVisible();
  await tabletsTab.click();
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
  await login(page); await open(page, shops);
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await expect(page.locator("#teacher-panel-tablets")).toBeHidden();
  await expect(tabletsTab).toBeHidden();
  await expect(page.locator("#workspace-tablet-usage")).toBeHidden();
});

test("organizes units, keeps content identities and flushes autosave before switching", async ({ page }) => {
  await login(page); await open(page, shops);
  await expect(page.locator("#set-editor-panel")).toHaveAttribute("role", "region");
  await expect(page.locator("body")).not.toHaveClass(/has-modal-open/);
  await page.locator("#set-title-input").fill(shops.title + " edited");
  await page.getByRole("button", { name: `Set ${rooms.title} öffnen`, exact: true }).click();
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title);
  await page.getByRole("button", { name: `Set ${shops.title} edited öffnen`, exact: true }).click();
  await expect(page.locator("#set-title-input")).toHaveValue(shops.title + " edited");
  const saved = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  expect(saved.cards.map(card => card.id)).toEqual(shops.cards.map(card => card.id));
  expect(saved.shareCode).toBe(shops.shareCode);
  await page.getByRole("button", { name: "+ Unit anlegen", exact: true }).click();
  await page.locator("#workspace-unit-name").fill(prefix + " · Unit 2");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#set-unit-input option", { hasText: prefix + " · Unit 2" })).toHaveCount(1);
  await page.locator("#set-unit-input").selectOption({ label: prefix + " · Unit 2" });
  await expect(page.locator("#workspace-breadcrumb")).toContainText("Unit 2");
  const moved = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  expect(moved.revision).toBe(saved.revision); expect(moved.updatedAt).toBe(saved.updatedAt);
  await page.reload(); await expect(page.locator("#set-title-input")).toHaveValue(saved.title);
  await expect(page.locator("#set-unit-input")).toHaveValue(moved.unitId);
  await page.locator("#workspace-search").fill("Room things");
  await expect(page.locator(".workspace-set-row")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/teacher-workspace/desktop-light.png" });
});

test("side selection does not steal focus from an already chosen vocabulary field", async ({ page }) => {
  await login(page); await open(page, rooms);
  await page.evaluate(() => {
    for (const [side, value] of [["front", "en"], ["back", "de"]]) {
      const select = document.querySelector(`[data-editor-side-select="${side}"]`);
      select.value = value; select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.querySelectorAll(".set-card-editor-row input")[1].focus();
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator(".set-card-editor-row input").nth(1)).toBeFocused();
});

test("failed autosave retains the editor; retry confirms persistence and stale loads cannot replace a newer selection", async ({ page }) => {
  await login(page); await open(page, rooms);
  await page.route(`**/api/teacher/sets/${rooms.id}`, async route => {
    if (route.request().method() === "PUT") return route.fulfill({ status: 503, json: { error: "Test: nicht gespeichert" } });
    return route.continue();
  });
  await page.locator("#set-title-input").fill(rooms.title + " pending");
  await page.getByRole("button", { name: `Set ${shops.title} öffnen`, exact: true }).click();
  await expect(page.locator("#workspace-save-status")).toHaveText("Nicht gespeichert");
  await expect(page.locator("#set-editor-feedback")).toContainText("nicht gespeichert");
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title + " pending");
  expect((await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set.title).toBe(rooms.title);
  await page.unroute(`**/api/teacher/sets/${rooms.id}`);
  await page.getByRole("button", { name: "Erneut versuchen", exact: true }).click();
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  await page.getByRole("button", { name: `Set ${shops.title} öffnen`, exact: true }).click();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(`**/api/teacher/sets/${rooms.id}`, async route => { await gate; await route.continue(); });
  await page.getByRole("button", { name: `Set ${rooms.title} pending öffnen`, exact: true }).click();
  await expect(page.locator("#workspace-editor-loading")).toBeVisible();
  const other = page.locator(".workspace-set-row").filter({ hasText: "Station 1" }).first();
  const otherTitle = await other.locator(".workspace-set-title").textContent();
  await other.click(); await expect(page.locator("#set-title-input")).toHaveValue(otherTitle);
  release(); await page.waitForTimeout(200);
  await expect(page.locator("#set-title-input")).toHaveValue(otherTitle);
});

test("units rename and remove without deleting their sets", async ({ page }) => {
  await login(page); await open(page, shops);
  const created = await (await page.request.post("/api/teacher/units", { data: { name: "BL3 · Organisation" } })).json();
  await page.reload();
  await page.locator("#set-unit-input").selectOption(created.unit.id);
  await expect.poll(async () => (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set.unitId).toBe(created.unit.id);
  await page.getByLabel("Unit BL3 · Organisation verwalten").click();
  await page.getByRole("button", { name: "Umbenennen", exact: true }).click();
  await page.locator("#workspace-unit-name").fill("BL3 · Umbenannt");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#set-unit-input")).toHaveValue(created.unit.id);
  await page.getByLabel("Unit BL3 · Umbenannt verwalten").click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Entfernen", exact: true }).click();
  await expect(page.locator("#set-unit-input")).toHaveValue("");
  const retained = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  expect(retained.cards.map(card => card.id)).toEqual(shops.cards.map(card => card.id));
  expect(retained.shareCode).toBe(shops.shareCode);
});

test("new sets exist immediately in their unit; partial rows and side choices survive reload without publication", async ({ page }) => {
  await login(page);
  await page.locator(`[data-library-view="${unit.id}"]`).click();
  await page.getByRole("button", { name: "+ Neues Set", exact: true }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#set-unit-input")).toHaveValue(unit.id);
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const id = new URL(page.url()).searchParams.get("set");
  expect((await (await page.request.get(`/api/teacher/sets/${id}`)).json()).set.cards).toHaveLength(0);
  await expect(page.locator("#workspace-share")).toBeEnabled();
  await expect(page.locator("#workspace-set-menu")).toBeVisible();
  await page.locator("#set-title-input").fill("BL3 · Neues Set");
  await page.locator('[data-editor-side-select="front"]').selectOption("en");
  const fields = page.locator(".set-card-editor-row").first().locator("input");
  await fields.nth(0).fill("a book");
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const partial = (await (await page.request.get(`/api/teacher/sets/${id}`)).json()).set;
  expect(partial.unitId).toBe(unit.id); expect(partial.cards[0].back).toBe("");
  await expect(page.locator("#workspace-share")).toBeEnabled();
  expect((await (await page.request.get("/" + partial.path)).json()).cards).toHaveLength(0);
  await page.reload();
  await expect(page.locator("#set-title-input")).toHaveValue("BL3 · Neues Set");
  await expect(page.locator('[data-editor-side-select="front"]')).toHaveValue("en");
  await expect(page.locator(".set-card-editor-row input").first()).toHaveValue("a book");
  await page.locator('[data-editor-side-select="back"]').selectOption("de");
  await page.locator(".set-card-editor-row input").nth(1).fill("ein Buch");
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const saved = (await (await page.request.get(`/api/teacher/sets/${id}`)).json()).set;
  expect(saved.shareCode).toBe(partial.shareCode);
  expect((await (await page.request.get("/" + saved.path)).json()).cards).toHaveLength(1);
  await expect(page.locator("#save-set-button, #save-and-generate-button, [data-library-view='drafts']")).toHaveCount(0);
  await page.request.delete(`/api/teacher/sets/${id}`);
});

test("save acknowledgements never replace focused inputs; newer edits queue behind the pending save", async ({ page }) => {
  await login(page); await open(page, rooms);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writes = 0;
  await page.route(`**/api/teacher/sets/${rooms.id}`, async route => {
    if (route.request().method() === "PUT" && ++writes === 1) await gate;
    await route.continue();
  });
  const title = page.locator("#set-title-input");
  await title.fill(rooms.title + " first");
  await expect.poll(() => writes).toBe(1);
  await title.evaluate(input => { window.originalAutosaveInput = input; input.setSelectionRange(4, 4); });
  await title.fill(rooms.title + " final");
  await title.evaluate(input => input.setSelectionRange(4, 4));
  await expect(page.locator("#workspace-save-status")).toHaveText("Wird gespeichert …");
  release();
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  await expect(title).toBeFocused();
  expect(await title.evaluate(input => input === window.originalAutosaveInput && input.selectionStart === 4)).toBeTruthy();
  expect((await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set.title).toBe(rooms.title + " final");
  expect(writes).toBe(2);
});

test("an expired session keeps unsaved text available and retries successfully after login", async ({ page }) => {
  await login(page); await open(page, rooms);
  await page.route(`**/api/teacher/sets/${rooms.id}`, async route => {
    if (route.request().method() === "PUT") return route.fulfill({ status: 401, json: { error: "Sitzung abgelaufen" } });
    return route.continue();
  });
  await page.locator("#set-title-input").fill(rooms.title + " retained");
  await expect(page.locator("#workspace-save-status")).toHaveText("Nicht gespeichert");
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title + " retained");
  const loginLink = page.getByRole("link", { name: "Anmeldung öffnen", exact: true });
  await expect(loginLink).toBeVisible(); await expect(loginLink).toHaveAttribute("target", "_blank");
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await page.unroute(`**/api/teacher/sets/${rooms.id}`);
  await page.getByRole("button", { name: "Erneut versuchen", exact: true }).click();
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  expect((await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set.title).toBe(rooms.title + " retained");
});

test("a second editor cannot silently replace changes from the first editor", async ({ page, context }) => {
  await login(page); await open(page, rooms);
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.locator("#set-title-input")).toHaveValue(rooms.title);
  await page.locator("#set-title-input").fill(rooms.title + " first");
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  await second.locator("#set-title-input").fill(rooms.title + " second");
  await expect(second.locator("#workspace-save-status")).toHaveText("Nicht gespeichert");
  await expect(second.locator("#set-editor-feedback")).toContainText("anderen Ansicht");
  await expect(second.locator("#set-title-input")).toHaveValue(rooms.title + " second");
  expect((await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set.title).toBe(rooms.title + " first");
  // The test deliberately abandons the conflicting local text after checking that it survives.
  await second.close({ runBeforeUnload: false });
});

test("a library refresh failure after confirmation retains the saved content and card identities", async ({ page }) => {
  await login(page); await open(page, rooms);
  await page.locator("#set-title-input").fill(rooms.title + " saved");
  await page.route("**/api/sets", route => route.fulfill({ status: 503, json: { error: "Refresh unavailable" } }));
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title + " saved");
  const saved = (await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set;
  expect(saved.title).toBe(rooms.title + " saved");
  expect(saved.cards[0].id).toBe(rooms.cards[0].id);
  await page.getByRole("button", { name: "+ Unit anlegen", exact: true }).click();
  await page.locator("#workspace-unit-name").fill("BL3 · Gesichert");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByLabel("Unit BL3 · Gesichert verwalten")).toBeVisible();
  await expect(page.locator("#workspace-library-feedback")).toHaveText("Unit gespeichert. Die Bibliothek konnte gerade nicht aktualisiert werden.");
  const createdUnitId = await page.locator("#set-unit-input option", { hasText: "BL3 · Gesichert" }).getAttribute("value");
  await page.locator("#set-unit-input").selectOption(createdUnitId);
  await expect(page.locator("#set-editor-feedback")).toHaveText("Zuordnung gespeichert. Die Bibliothek konnte gerade nicht aktualisiert werden.");
  await expect(page.locator("#set-unit-input")).toHaveValue(createdUnitId);
  await page.request.delete(`/api/teacher/units/${createdUnitId}`);
  await page.unroute("**/api/sets");
  await page.getByRole("button", { name: `Set ${shops.title} öffnen`, exact: true }).click();
  await expect(page.locator("#editor-leave-overlay")).toHaveCount(0);
});

test("failed unit moves retain the assignment and show their error in the mobile editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await login(page); await open(page, rooms);
  await page.route(`**/api/teacher/sets/${rooms.id}/unit`, route => route.abort());
  await page.locator("#set-unit-input").selectOption("");
  await expect(page.locator("#set-editor-feedback")).toHaveText("Zuordnung konnte nicht gespeichert werden. Bitte erneut versuchen.");
  await expect(page.locator("#set-editor-feedback")).toBeInViewport();
  await expect(page.locator("#set-unit-input")).toHaveValue(unit.id);
  await expect(page.locator("#set-unit-input")).toBeEnabled();
});

test("admin chooses an owner's library without gaining organization or deletion rights", async ({ page }) => {
  await login(page, "julius");
  await page.getByLabel("Bibliothek der Lehrkraft").selectOption("aksana");
  await open(page, shops);
  await expect(page.locator("#set-unit-input")).toBeDisabled();
  await expect(page.locator("#workspace-create-unit")).toBeHidden();
  await expect(page.locator("#workspace-delete")).toBeHidden();
  const move = await page.request.put(`/api/teacher/sets/${shops.id}/unit`, { data: { unitId: "" } });
  expect(move.status()).toBe(404);
  const remove = await page.request.delete(`/api/teacher/units/${unit.id}`);
  expect(remove.status()).toBe(404);
  await page.screenshot({ path: "artifacts/teacher-workspace/admin.png" });
});

test("learning opens the familiar student mode selection in another tab and keeps the editor", async ({ page, context }) => {
  await login(page); await open(page, rooms);
  let progressWrites = 0;
  await context.route("**/api/tablets/**/learning-progress/**", async route => { progressWrites++; await route.abort(); });
  await page.locator("#set-title-input").fill(rooms.title + " for learning");
  const newPage = context.waitForEvent("page");
  await page.getByRole("link", { name: "Lernmodi öffnen", exact: false }).click();
  const learning = await newPage;
  await expect(learning.locator("#launch-mode-modal")).toBeVisible();
  await expect(learning.locator(".launch-mode-modal__mode-card")).toHaveCount(3);
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title + " for learning");
  await learning.locator('.launch-mode-modal__mode-card[data-mode-key="practice"]').click();
  await learning.locator("#launch-mode-start").click();
  await expect(learning.locator("#launch-settings-modal")).toBeVisible();
  await learning.locator("#launch-settings-start").click();
  await expect(learning.locator("#card-stage")).toBeVisible();
  expect(progressWrites).toBe(0);
  const closed = learning.waitForEvent("close");
  await learning.locator("#student-home-link").click(); await closed;
  await page.bringToFront();
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title + " for learning");
});

for (const mode of ["light", "dark"]) {
  test(`${mode}: desktop and touch layouts fit with a larger library`, async ({ page }) => {
    await page.addInitScript(mode => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode })), mode);
    await login(page); await open(page, rooms);
    for (const width of [1920, 1440, 1024, 720, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: `artifacts/teacher-workspace/${mode}-${width}.png`, fullPage: true });
    }
    await page.locator("#set-editor-close").click();
    await expect(page.locator("#workspace-library")).toBeVisible();
    await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
    await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
    await login(page, "julius");
    for (const width of [1440, 720, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("tab", { name: "Tablets", exact: true }).click();
      await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
      await expect(page.locator("#teacher-panel-tablets")).not.toHaveClass(/ui-motion-surface-entering/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: `artifacts/teacher-workspace/admin-tabs-${mode}-${width}.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("tab", { name: "Lernsets", exact: true }).click();
    }
  });
}
