const { test, expect } = require("./teacher-release-fixture.cjs");
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
async function dragToFolder(page, setId, unitId) {
  await page.locator(`[data-open-set="${setId}"]`).dragTo(page.locator(`[data-library-view="${unitId || "unfiled"}"]`));
}


test("tablet connections require admin rights while device sessions keep their own access", async ({ page, playwright }) => {
  let directoryRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/tablets") directoryRequests++; });
  await login(page); await open(page, shops);
  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.locator('[data-teacher-section="tablets"]')).toBeHidden();
  await expect(page.locator("#workspace-tablet-usage")).toBeHidden();
  await expect(page.getByLabel("Angezeigtes Profil")).toBeHidden();
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

test("tablet info stays in the header, refreshes pupil subscriptions and never removes them", async ({ page, playwright }) => {
  await login(page, "julius");
  await page.locator("#workspace-owner").selectOption("aksana");
  await open(page, shops);
  const usage = page.locator("#workspace-tablet-usage");
  const toggle = page.locator("#workspace-tablet-info-toggle");
  const panel = page.locator("#workspace-tablet-info-panel");
  await expect(page.locator("#workspace-use-actions #workspace-tablet-usage")).toBeVisible();
  await expect(page.locator("#set-editor-panel > #workspace-tablet-usage")).toHaveCount(0);
  let subscriptionDeletes = 0;
  page.on("request", request => {
    if (request.method() === "DELETE" && new URL(request.url()).pathname.endsWith("/subscriptions")) subscriptionDeletes++;
  });
  const pupil = await playwright.request.newContext({ baseURL: BASE_URL });
  const tabletPath = "/api/tablets/blau-6";
  try {
    expect((await page.request.post(tabletPath + "/decouple")).ok()).toBeTruthy();
    const registered = await pupil.post(tabletPath + "/register", { data: { pin: "6472" } });
    expect(registered.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await registered.json()).session.token}` };
    expect((await pupil.post(tabletPath + "/subscriptions", { headers, data: { setPath: shops.path } })).ok()).toBeTruthy();
    await toggle.hover();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Blau 6");
    await expect(toggle).toHaveText("1 Tablet");
    await expect(panel.getByRole("button")).toHaveCount(0);
    await expect(page.getByText("Vom Tablet entfernen", { exact: true })).toHaveCount(0);
    await page.mouse.move(900, 850); await expect(panel).toBeHidden();
    await toggle.focus(); await expect(panel).toBeVisible();
    await toggle.press("Escape"); await expect(panel).toBeHidden(); await expect(toggle).toBeFocused();
    await toggle.click(); await expect(panel).toBeVisible();
    await page.mouse.move(900, 850); await expect(panel).toBeVisible();
    await page.locator("#set-title-input").fill(shops.title + " with info");
    await expect(panel).toBeHidden();
    await toggle.click(); await expect(panel).toBeVisible();
    await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
    await expect(panel).toBeVisible();
    const subscriptions = (await (await pupil.get(tabletPath + "/subscriptions", { headers })).json()).subscriptions;
    expect(subscriptions.map(entry => entry.setPath)).toContain(shops.path);
    expect(subscriptionDeletes).toBe(0);
    await toggle.click(); await expect(panel).toBeHidden();
    expect((await pupil.delete(tabletPath + `/subscriptions?set=${encodeURIComponent(shops.path)}`, { headers })).ok()).toBeTruthy();
    await toggle.click(); await expect(toggle).toHaveText("0 Tablets");
    await expect(panel).toHaveText("Noch kein Tablet hat dieses Set.");
    await page.setViewportSize({ width: 390, height: 900 });
    const box = await panel.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    await toggle.press("Escape"); await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
    await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
    await login(page); await open(page, { ...shops, title: shops.title + " with info" }); await expect(usage).toBeHidden();
  } finally {
    await page.request.post("/api/teacher/session", { data: { teacherId: "julius", password: PASSWORD } });
    await page.request.post(tabletPath + "/decouple");
    await pupil.dispose();
  }
});

test("admin heading menu supports keyboard and dismissal; regular teachers keep a plain heading", async ({ page }) => {
  await login(page, "julius");
  const toggle = page.locator("#teacher-section-toggle");
  const menu = page.locator("#teacher-section-menu");
  const setsChoice = page.locator('[data-teacher-section="sets"]');
  const tabletsChoice = page.locator('[data-teacher-section="tablets"]');
  await expect(toggle).toBeEnabled();
  await toggle.focus(); await toggle.press("ArrowDown");
  await expect(menu).toBeVisible(); await expect(setsChoice).toBeFocused();
  await setsChoice.press("End"); await expect(tabletsChoice).toBeFocused();
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await tabletsChoice.press("Enter");
  await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
  await expect(tabletsChoice).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toBeFocused(); await expect(toggle).toHaveText("Tablets");
  await toggle.click(); await tabletsChoice.press("Home"); await expect(setsChoice).toBeFocused();
  await setsChoice.press("Enter"); await expect(toggle).toHaveText("Lernsets");
  await toggle.click(); await setsChoice.press("Escape");
  await expect(menu).toBeHidden(); await expect(toggle).toBeFocused();
  await toggle.click(); await page.locator("#teacher-profile-name").click();
  await expect(menu).toBeHidden();
  await toggle.click(); await setsChoice.press("Tab"); await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await open(page, (await (await page.request.get("/api/sets")).json()).sets.find(set => set.ownerTeacherId === "julius"));
  await expect(page.locator("#workspace-tablet-usage")).toBeVisible();
  await toggle.click(); await tabletsChoice.click();
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await expect(menu).toBeHidden();
  await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
  await login(page); await open(page, shops);
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await expect(page.locator("#teacher-panel-tablets")).toBeHidden();
  await expect(toggle).toBeDisabled(); await expect(menu).toBeHidden();
  await expect(page.locator("#teacher-section-chevron")).toBeHidden();
  await expect(page.locator("#workspace-tablet-usage")).toBeHidden();
});

test("library has two categories, restores old all views and creates unfiled sets", async ({ page }) => {
  await page.addInitScript(saved => localStorage.setItem("lerndeck-teacher-workspace-v1:aksana", JSON.stringify(saved)), { owner: "aksana", view: "all", selected: rooms.id });
  await login(page);
  await expect(page.locator('[data-library-view="all"]')).toHaveCount(0);
  await expect(page.locator('#workspace-navigation h3')).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Lerndecks", exact: true })).toBeVisible();
  await expect(page.locator(`[data-library-view="${unit.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#set-title-input")).toHaveValue(rooms.title);
  await page.goto(`/teacher?owner=aksana&unit=all&set=${rooms.id}`);
  await expect(page.locator("#sets-title")).toHaveText(unit.name);
  await expect.poll(() => new URL(page.url()).searchParams.get("unit")).toBe(unit.id);
  const unfiled = page.locator('[data-library-view="unfiled"]');
  await unfiled.click();
  await expect(unfiled).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#sets-title")).toHaveText("Nicht eingeordnet");
  await expect(page.locator("#teacher-empty-state")).toHaveText("Keine Sets");
  await page.getByRole("button", { name: "Lernset anlegen", exact: true }).click();
  await expect(page.locator("#set-title-input")).toHaveValue("Neues Lernset");
  await expect.poll(() => new URL(page.url()).searchParams.get("set")).not.toBe(rooms.id);
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const id = new URL(page.url()).searchParams.get("set");
  expect(id).toBeTruthy();
  expect([shops.id, rooms.id]).not.toContain(id);
  try {
    expect((await (await page.request.get(`/api/teacher/sets/${id}`)).json()).set.unitId).toBe("");
    await page.reload();
    await expect(page.locator('[data-library-view="unfiled"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`[data-open-set="${id}"]`)).toBeVisible();
  } finally { await page.request.delete(`/api/teacher/sets/${id}`); }
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
  await page.getByRole("button", { name: "Lerndeck anlegen", exact: true }).click();
  await page.locator("#workspace-unit-name").fill(prefix + " · Unit 2");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  const folder = page.locator("[data-library-view]", { hasText: prefix + " · Unit 2" });
  await expect(folder).toBeVisible();
  await dragToFolder(page, shops.id, await folder.getAttribute("data-library-view"));
  await expect(page.locator("#workspace-breadcrumb")).toContainText("Unit 2");
  const moved = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  expect(moved.revision).toBe(saved.revision); expect(moved.updatedAt).toBe(saved.updatedAt);
  await page.reload(); await expect(page.locator("#set-title-input")).toHaveValue(saved.title);
  await expect(page.locator("#set-unit-input")).toHaveCount(0);
  await expect(page.locator("#workspace-breadcrumb")).toContainText("Unit 2");
  await expect(page.locator("#workspace-search")).toHaveCount(0);
  await page.evaluate(() => {
    const key = "lerndeck-teacher-workspace-v1:aksana";
    const saved = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...saved, search: "no matching set" }));
  });
  await page.reload();
  await expect(page.locator("#set-title-input")).toHaveValue(saved.title);
  await expect(page.locator(".workspace-set-row")).toHaveCount(29);
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

test("library drag and drop moves sets, sorts sets and decks, and preserves the open editor", async ({ page }) => {
  await login(page); await open(page, shops);
  const before = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  const folder = (await (await page.request.post("/api/teacher/units", { data: { name: "BL3 · Drag target" } })).json()).unit;
  try {
    await page.reload(); await expect(page.locator("#set-title-input")).toHaveValue(shops.title);
    await dragToFolder(page, shops.id, folder.id);
    await expect(page.locator("#workspace-breadcrumb")).toContainText(folder.name);
    await page.locator(`[data-library-view="${folder.id}"]`).click();
    await expect(page.locator("[data-open-set]")).toHaveCount(1);
    await dragToFolder(page, shops.id, "");
    await expect(page.locator("[data-open-set]")).toHaveCount(0);
    await expect(page.locator("#workspace-breadcrumb")).toContainText("Nicht eingeordnet");
    await page.locator('[data-library-view="unfiled"]').click();
    await dragToFolder(page, shops.id, unit.id);
    await expect(page.locator("#workspace-breadcrumb")).toContainText(unit.name);
    await page.locator(`[data-library-view="${unit.id}"]`).click();
    await page.locator(`[data-open-set="${rooms.id}"]`).dragTo(page.locator(`[data-open-set="${shops.id}"]`), { targetPosition: { x: 35, y: 5 } });
    await expect(page.locator("#teacher-workspace")).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#workspace-library-feedback")).toBeEmpty();
    let ids = await page.locator("[data-open-set]").evaluateAll(rows => rows.map(row => row.dataset.openSet));
    expect(ids.indexOf(rooms.id)).toBeLessThan(ids.indexOf(shops.id));
    await page.locator(`[data-open-set="${shops.id}"]`).press("Alt+ArrowUp");
    await expect.poll(async () => (await page.locator("[data-open-set]").evaluateAll(rows => rows.map(row => row.dataset.openSet))).indexOf(shops.id)).toBeLessThan(ids.indexOf(rooms.id) + 1);
    await page.locator(`[data-library-view="${folder.id}"]`).dragTo(page.locator(`[data-library-view="${unit.id}"]`), { targetPosition: { x: 30, y: 3 } });
    await expect.poll(async () => (await page.locator('.workspace-unit-row [data-library-view]').evaluateAll(rows => rows.map(row => row.dataset.libraryView)))[0]).toBe(folder.id);
    await page.reload(); await expect(page.locator("#set-title-input")).toHaveValue(shops.title);
    ids = await page.locator("[data-open-set]").evaluateAll(rows => rows.map(row => row.dataset.openSet));
    expect(ids.indexOf(shops.id)).toBeLessThan(ids.indexOf(rooms.id));
    const after = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
    expect(after.cards).toEqual(before.cards); expect(after.shareCode).toBe(before.shareCode);
    expect(after.revision).toBe(before.revision); expect(after.updatedAt).toBe(before.updatedAt);
    await expect(page.locator("#set-unit-input")).toHaveCount(0);
    await page.screenshot({ path: "artifacts/teacher-workspace/library-drag-desktop.png" });
  } finally { await page.request.delete(`/api/teacher/units/${folder.id}`); }
});

test("autosave confirmation keeps a native grip drag intact until the folder drop", async ({ page }) => {
  await login(page); await open(page, shops);
  let release; const gate = new Promise(resolve => { release = resolve; }); let writes = 0;
  await page.route(`**/api/teacher/sets/${shops.id}`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++; await gate; await route.continue();
  });
  const handle = await page.locator(`[data-open-set="${shops.id}"]`).elementHandle();
  const grip = await page.locator(`[data-open-set="${shops.id}"] .workspace-drag-handle`).boundingBox();
  const target = page.locator('[data-library-view="unfiled"]'); const box = await target.boundingBox();
  try {
    await page.locator("#set-title-input").fill(shops.title + " dragging");
    await expect.poll(() => writes).toBe(1);
    await page.mouse.move(grip.x + grip.width/2, grip.y + grip.height/2); await page.mouse.down();
    await page.mouse.move(grip.x + 12, grip.y + 12); await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 8 });
    await expect(page.locator(`[data-open-set="${shops.id}"]`)).toHaveClass(/is-dragging/);
    release(); await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
    expect(await handle.evaluate(row => row.isConnected)).toBeTruthy();
    await page.mouse.move(box.x + box.width/2 + 1, box.y + box.height/2); await page.mouse.up();
    await expect(page.locator("#workspace-breadcrumb")).toContainText("Nicht eingeordnet");
    await expect(page.locator("#set-title-input")).toHaveValue(shops.title + " dragging");
    const saved = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
    expect(saved.unitId).toBe(""); expect(saved.title).toBe(shops.title + " dragging");
  } finally { release(); await page.mouse.up(); }
});

test("touch grips move sets without opening or replacing the editor", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Real touch movement is exercised through Chromium's device protocol.");
  await login(page); await open(page, shops);
  const session = await context.newCDPSession(page);
  const grip = await page.locator(`[data-open-set="${shops.id}"] .workspace-drag-handle`).boundingBox();
  const target = page.locator('[data-library-view="unfiled"]'); const box = await target.boundingBox();
  const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let i = 1; i <= 8; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x-start.x)*i/8, y: start.y + (end.y-start.y)*i/8 }] });
  await expect(target).toHaveAttribute("data-drop-position", "inside");
  await page.screenshot({ path: "artifacts/teacher-workspace/library-touch-drag.png" });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("#workspace-breadcrumb")).toContainText("Nicht eingeordnet");
  await expect(page.locator("#set-title-input")).toHaveValue(shops.title);
  await expect(page.locator(".workspace-drag-preview")).toHaveCount(0);
  await session.detach();
});

test("units rename and remove without deleting their sets", async ({ page }) => {
  await login(page); await open(page, shops);
  const created = await (await page.request.post("/api/teacher/units", { data: { name: "BL3 · Organisation" } })).json();
  await page.reload();
  await dragToFolder(page, shops.id, created.unit.id);
  await expect.poll(async () => (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set.unitId).toBe(created.unit.id);
  const deck = page.locator(`[data-library-view="${created.unit.id}"]`);
  await deck.click();
  await expect(deck).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".workspace-unit-row summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await deck.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Abmelden", exact: true })).toBeHidden();
  const menu = page.getByRole("menu", { name: "Lerndeck BL3 · Organisation verwalten" });
  await expect(menu).toBeVisible();
  const rename = menu.getByRole("menuitem", { name: "Umbenennen", exact: true });
  const remove = menu.getByRole("menuitem", { name: "Entfernen", exact: true });
  await expect(rename).toBeFocused();
  await rename.press("ArrowDown"); await expect(remove).toBeFocused();
  await remove.press("Escape"); await expect(menu).toBeHidden(); await expect(deck).toBeFocused();
  await deck.press("Shift+F10"); await expect(rename).toBeFocused();
  await page.locator("#sets-title").click(); await expect(menu).toBeHidden();
  await deck.click({ button: "right" });
  await rename.click();
  await page.locator("#workspace-unit-name").fill("BL3 · Umbenannt");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#workspace-breadcrumb")).toContainText("BL3 · Umbenannt");
  await deck.click({ button: "right" });
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("menuitem", { name: "Entfernen", exact: true }).click();
  await expect(page.locator("#workspace-breadcrumb")).toContainText("BL3 · Umbenannt");
  await deck.click({ button: "right" });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("menuitem", { name: "Entfernen", exact: true }).click();
  await expect(page.locator("#workspace-breadcrumb")).toContainText("Nicht eingeordnet");
  const retained = (await (await page.request.get(`/api/teacher/sets/${shops.id}`)).json()).set;
  await expect(page.locator('[data-library-view="unfiled"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-open-set="${shops.id}"]`)).toBeVisible();
  expect(retained.cards.map(card => card.id)).toEqual(shops.cards.map(card => card.id));
  expect(retained.shareCode).toBe(shops.shareCode);
});

test("touch long press opens deck options without switching the library or starting a drag", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Native touch protocol is covered in Chromium.");
  await login(page); await open(page, shops);
  const session = await context.newCDPSession(page);
  const deck = page.locator(`[data-library-view="${unit.id}"]`);
  const box = await deck.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const active = await page.locator('[data-library-view][aria-pressed="true"]').getAttribute("data-library-view");
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await expect(page.getByRole("menu", { name: `Lerndeck ${unit.name} verwalten` })).toBeVisible();
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator('[data-library-view][aria-pressed="true"]')).toHaveAttribute("data-library-view", active);
  await expect(page.locator(".workspace-drag-preview")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Umbenennen", exact: true }).press("Escape");
  await expect(deck).toBeFocused();
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{x: point.x + 20, y: point.y}] });
  await page.waitForTimeout(600);
  await expect(page.getByRole("menu")).toBeHidden();
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
});

test("new sets exist immediately in their unit; partial rows and side choices survive reload without publication", async ({ page }) => {
  await login(page);
  await page.locator(`[data-library-view="${unit.id}"]`).click();
  await page.getByRole("button", { name: "Lernset anlegen", exact: true }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#workspace-breadcrumb")).toContainText(unit.name);
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const id = new URL(page.url()).searchParams.get("set");
  expect((await (await page.request.get(`/api/teacher/sets/${id}`)).json()).set.cards).toHaveLength(0);
  await expect(page.locator("#workspace-share")).toBeEnabled();
  await expect(page.locator("#workspace-delete")).toBeVisible();
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

test("vocabulary pictures survive queued text edits and reload", async ({ page }) => {
  const service = new SetService({ dataDir: DATA_DIR });
  await service.assignCardVisuals("aksana", rooms.id, [{ cardId: rooms.cards[0].id,
    visual: { assetId: "vis_editor_preserve", alt: "Shelf", width: 512, height: 512 } }]);
  await page.route("**/media/visuals/vis_editor_preserve.webp", route => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>',
  }));
  await login(page); await open(page, rooms);
  let release; const gate = new Promise(resolve => { release = resolve; });
  let writes = 0;
  await page.route(`**/api/teacher/sets/${rooms.id}`, async route => {
    if (route.request().method() === "PUT" && ++writes === 1) await gate;
    await route.continue();
  });
  const field = page.locator(".set-card-editor-row .set-editor-field--card input").nth(1);
  await field.fill("ein Regal korrigiert");
  await expect.poll(() => writes).toBe(1);
  await field.fill("ein Regal final");
  release();
  await expect(page.locator("#workspace-save-status")).toHaveText("Gespeichert");
  const saved = (await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set;
  expect(saved.cards[0].id).toBe(rooms.cards[0].id);
  expect(saved.cards[0].visual.assetId).toBe("vis_editor_preserve");
  await expect(page.getByRole("button", { name: "Bild zu Vokabel 1 ansehen" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Bild zu Vokabel 1 ansehen" })).toBeVisible();
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
  await page.getByRole("button", { name: "Lerndeck anlegen", exact: true }).click();
  await page.locator("#workspace-unit-name").fill("BL3 · Gesichert");
  await page.locator("#workspace-unit-form").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("[data-library-view]", { hasText: "BL3 · Gesichert" })).toBeVisible();
  await expect(page.locator("#workspace-library-feedback")).toHaveText("Lerndeck gespeichert. Die Bibliothek konnte gerade nicht aktualisiert werden.");
  const createdUnitId = await page.locator("[data-library-view]", { hasText: "BL3 · Gesichert" }).getAttribute("data-library-view");
  await dragToFolder(page, rooms.id, createdUnitId);
  await expect(page.locator("#teacher-workspace")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#workspace-library-feedback")).toBeEmpty();
  await expect(page.locator("#workspace-breadcrumb")).toContainText("BL3 · Gesichert");
  await page.request.delete(`/api/teacher/units/${createdUnitId}`);
  await page.unroute("**/api/sets");
  await page.getByRole("button", { name: `Set ${shops.title} öffnen`, exact: true }).click();
  await expect(page.locator("#editor-leave-overlay")).toHaveCount(0);
});

test("failed library moves retain the assignment and show their error in the mobile library", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await login(page); await open(page, rooms);
  await page.route(`**/api/teacher/sets/${rooms.id}/unit`, route => route.abort());
  await page.locator("#set-editor-close").click();
  await dragToFolder(page, rooms.id, "");
  await expect(page.locator("#workspace-library-feedback")).toHaveText("Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.");
  await expect(page.locator("#workspace-library-feedback")).toBeInViewport();
  expect((await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set.unitId).toBe(unit.id);
  await expect(page.locator(`[data-open-set="${rooms.id}"]`)).toHaveAttribute("draggable", "true");
});

test("admin chooses an owner's library without gaining organization or deletion rights", async ({ page }) => {
  await login(page, "julius");
  await expect(page.locator(".teacher-header #workspace-owner-field")).toBeVisible();
  await expect(page.locator("#workspace-units #workspace-owner-field")).toHaveCount(0);
  await page.getByLabel("Angezeigtes Profil").selectOption("aksana");
  await open(page, shops);
  await expect(page.locator("#set-unit-input")).toHaveCount(0);
  await expect(page.locator(`[data-open-set="${shops.id}"]`)).not.toHaveAttribute("draggable", "true");
  await expect(page.locator("#workspace-create-unit")).toBeHidden();
  await expect(page.locator("#workspace-delete")).toBeHidden();
  const foreignDeck = page.locator(`[data-library-view="${unit.id}"]`);
  await expect(foreignDeck).not.toHaveAttribute("aria-haspopup", "menu");
  const move = await page.request.put(`/api/teacher/sets/${shops.id}/unit`, { data: { unitId: "" } });
  expect(move.status()).toBe(404);
  const order = await page.request.put("/api/teacher/library/order", { data: { kind: "sets", id: shops.id, beforeId: null } });
  expect(order.status()).toBe(404);
  const unitOrder = await page.request.put("/api/teacher/library/order", { data: { kind: "units", id: unit.id, beforeId: null } });
  expect(unitOrder.status()).toBe(404);
  const remove = await page.request.delete(`/api/teacher/units/${unit.id}`);
  expect(remove.status()).toBe(404);
  await page.screenshot({ path: "artifacts/teacher-workspace/admin.png" });
  for (const width of [700, 390]) {
    await page.setViewportSize({ width, height: 800 });
    if (width === 390) await page.evaluate(() => window.LerndeckAppearance.setMode("light"));
    await expect(page.getByLabel("Angezeigtes Profil")).toBeVisible();
    const bounds = await page.locator("#workspace-owner-field").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/teacher-workspace/admin-profile-${width}.png` });
  }
  await page.locator("#teacher-section-toggle").click();
  await page.getByRole("menuitemradio", { name: "Tablets", exact: true }).click();
  await expect(page.getByLabel("Angezeigtes Profil")).toBeHidden();
  await page.locator("#teacher-section-toggle").click();
  await page.getByRole("menuitemradio", { name: "Lernsets", exact: true }).click();
  await page.locator("#set-editor-close").click();
  // Check the native read-only context menu last; it consumes subsequent browser clicks in WebKit.
  await foreignDeck.click({ button: "right" });
  await expect(page.locator(".workspace-unit-menu")).toBeHidden();
});

test("learning opens the familiar student mode selection in another tab and keeps the editor", async ({ page, context }) => {
  await login(page); await open(page, rooms);
  let progressWrites = 0;
  await context.route("**/api/tablets/**/learning-progress/**", async route => { progressWrites++; await route.abort(); });
  await page.locator("#set-title-input").fill(rooms.title + " for learning");
  const newPage = context.waitForEvent("page");
  await page.getByRole("link", { name: "Lernen", exact: true }).click();
  const learning = await newPage;
  await expect(learning.locator("#launch-mode-modal")).toBeVisible();
  await expect(learning.locator(".launch-mode-modal__mode-card")).toHaveCount(4);
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
      await page.locator("#teacher-section-toggle").click();
      await page.getByRole("menuitemradio", { name: "Tablets", exact: true }).click();
      await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
      await expect(page.locator("#teacher-panel-tablets")).not.toHaveClass(/ui-motion-surface-entering/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: `artifacts/teacher-workspace/admin-tabs-${mode}-${width}.png`, fullPage: true, animations: "disabled" });
      await page.locator("#teacher-section-toggle").click();
      await page.getByRole("menuitemradio", { name: "Lernsets", exact: true }).click();
    }
  });
}

async function resizePanel(page, index, delta) {
  const box = await page.locator('.workspace-resizer').nth(index).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}
const panelWidth = (page, id) => page.locator(id).evaluate((node) => node.getBoundingClientRect().width);

test('desktop panels resize, snap, reopen and persist separately for each account', async ({ page }) => {
  await login(page);
  const initial = await panelWidth(page, '#workspace-units');
  await resizePanel(page, 0, 70);
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(initial + 70, 0);
  const libraryInitial = await panelWidth(page, '#workspace-library');
  await resizePanel(page, 1, -50);
  await expect.poll(() => panelWidth(page, '#workspace-library')).toBeCloseTo(libraryInitial - 50, 0);
  const saved = await panelWidth(page, '#workspace-library');
  await resizePanel(page, 0, -300);
  await expect(page.locator('#workspace-units')).toHaveAttribute('aria-hidden', 'true');
  await page.reload();
  await expect(page.locator('#workspace-units')).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => panelWidth(page, '#workspace-library')).toBeCloseTo(saved, 0);
  await resizePanel(page, 0, 210);
  await expect(page.locator('#workspace-units')).not.toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(210, 0);
  await login(page, 'julius');
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(initial, 0);
  await resizePanel(page, 0, 100);
  await login(page);
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(210, 0);
});

test('splitter keyboard, cancellation and compact layout preserve desktop choices', async ({ page }) => {
  await login(page);
  const handle = page.getByRole('separator', { name: 'Lernsets', exact: true });
  await handle.focus();
  await handle.press('End');
  const preferred = await panelWidth(page, '#workspace-library');
  await expect.poll(() => panelWidth(page, '#workspace-editor')).toBeGreaterThanOrEqual(479);
  await handle.press('Enter');
  await expect(page.locator('#workspace-library')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Lernsets aufklappen', exact: true }).click();
  await expect.poll(() => panelWidth(page, '#workspace-library')).toBeCloseTo(preferred, 0);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 100); await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y + 100);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect.poll(() => panelWidth(page, '#workspace-library')).toBeCloseTo(preferred, 0);
  await handle.press('Home');
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator('#workspace-library')).not.toHaveAttribute('inert', '');
  await expect(handle).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#workspace-library')).toHaveAttribute('inert', '');
  await handle.press('Enter');
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(() => panelWidth(page, '#workspace-editor')).toBeGreaterThanOrEqual(479);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => panelWidth(page, '#workspace-library')).toBeCloseTo(preferred, 0);
});

test('invalid layout preferences recover without changing navigation or set content', async ({ page }) => {
  await login(page);
  const current = (await (await page.request.get(`/api/teacher/sets/${rooms.id}`)).json()).set;
  await page.addInitScript(() => localStorage.setItem('lerndeck-teacher-workspace-v1:aksana', JSON.stringify({ layout: [{width:-200}, {width:'bad', collapsed:'yes'}] })));
  await page.reload();
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(160, 0);
  await expect(page.locator('#workspace-library')).not.toHaveAttribute('inert', '');
  const view = current.unitId || 'unfiled';
  await page.locator(`[data-library-view="${view}"]`).click();
  await open(page, current);
  await page.getByRole('separator', { name: 'Bibliothek', exact: true }).press('Enter');
  await expect(page.locator('#set-title-input')).toHaveValue(current.title);
  await page.getByRole('separator', { name: 'Bibliothek', exact: true }).press('Enter');
  await expect(page.locator(`[data-library-view="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
});

// Browsers can deny storage in managed/private environments; sizing must still work.
test('blocked storage and lost pointer capture keep the workspace usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await login(page);
  const news = page.getByRole("dialog", { name: "Was ist neu?" });
  await expect(news).toBeVisible();
  await news.getByRole("button", { name: "Weiter", exact: true }).click();
  const before = await panelWidth(page, '#workspace-units');
  const handle = page.getByRole('separator', { name: 'Bibliothek', exact: true });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 100); await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 100);
  await handle.evaluate(node => node.dispatchEvent(new Event('lostpointercapture')));
  await page.mouse.up();
  await expect.poll(() => panelWidth(page, '#workspace-units')).toBeCloseTo(before, 0);
  await handle.press('Enter');
  await expect(page.locator('#workspace-units')).toHaveAttribute('inert', '');
  await handle.press('ArrowRight');
  await expect(page.locator('#workspace-units')).not.toHaveAttribute('inert', '');
  expect(errors).toEqual([]);
});
