const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4036";
test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, serviceWorkers: "block", locale: "de-DE" });
const modal = page => page.getByRole("dialog", { name: "Was ist neu?" });
async function fixture(page, { authenticated = true, mustChangePassword = false } = {}) {
  const state = { authenticated, teacherId: "aksana", mustChangePassword };
  const teacher = () => ({ id: state.teacherId, displayName: state.teacherId, role: "teacher", mustChangePassword: state.mustChangePassword });
  await page.route("**/api/runtime-info", route => route.fulfill({ json: {} }));
  await page.route("**/api/teacher/accounts", route => route.fulfill({ json: { accounts: [{ id: "aksana", displayName: "Aksana" }, { id: "matti", displayName: "Matti" }] } }));
  await page.route("**/api/teacher/session", route => {
    if (route.request().method() === "POST") state.authenticated = true;
    return route.fulfill({ status: state.authenticated ? 200 : 401, json: state.authenticated ? { session: { teacherId: state.teacherId }, teacher: teacher() } : {} });
  });
  await page.route("**/api/sets", route => route.fulfill({ json: { sets: [], units: [], teacher: teacher() } }));
  await page.route("**/api/teacher/visual-jobs", route => route.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/teacher/password", route => { state.mustChangePassword = false; return route.fulfill({ json: { teacher: teacher() } }); });
  return state;
}
test("confirmation is account-scoped, persistent and release-scoped", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/teacher"); await expect(modal(page)).toBeVisible();
  await expect(modal(page).locator("section")).toHaveCount(4);
  await page.getByLabel("Diese Meldung nicht mehr anzeigen").check();
  await modal(page).getByRole("button", { name: "Weiter", exact: true }).click();
  await page.reload(); await expect(page.locator("#teacher-workspace")).toBeVisible(); await expect(modal(page)).not.toBeVisible();
  state.teacherId = "matti"; await page.reload(); await expect(modal(page)).toBeVisible();
  await page.getByRole("button", { name: "Neuigkeiten schließen" }).click();
  state.teacherId = "aksana";
  await page.evaluate(() => localStorage.setItem("lerndeck-whats-new-v1:aksana", "older-release"));
  await page.reload(); await expect(modal(page)).toBeVisible();
});
test("Escape and closing without confirmation do not acknowledge the notice", async ({ page }) => {
  await fixture(page); await page.goto("/teacher"); await expect(modal(page)).toBeVisible();
  await expect(page.locator("#teacher-whats-new-title")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.getElementById("teacher-whats-new").contains(document.activeElement))).toBe(true);
  await page.getByLabel("Diese Meldung nicht mehr anzeigen").check();
  await page.keyboard.press("Escape"); await expect(modal(page)).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lerndeck-whats-new-v1:aksana"))).toBeNull();
  await page.reload(); await expect(modal(page)).toBeVisible();
  await expect(page.getByLabel("Diese Meldung nicht mehr anzeigen")).not.toBeChecked();
  await modal(page).getByRole("button", { name: "Weiter", exact: true }).click();
  await page.reload(); await expect(modal(page)).toBeVisible();
});
test("storage denial still allows closing and using the workspace", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error("Blocked"); }; });
  await fixture(page); await page.goto("/teacher"); await expect(modal(page)).toBeVisible();
  await page.getByLabel("Diese Meldung nicht mehr anzeigen").check();
  await modal(page).getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(modal(page)).not.toBeVisible(); await expect(page.locator("#teacher-workspace")).toBeVisible();
});
test("login and required password change precede release highlights", async ({ page }) => {
  await fixture(page, { authenticated: false, mustChangePassword: true });
  await page.goto("/teacher"); await expect(page.locator("#teacher-auth-panel")).toBeVisible(); await expect(modal(page)).not.toBeVisible();
  await page.locator("#teacher-account-select").selectOption("aksana");
  await page.locator("#teacher-password-input").fill("TestPassword123!");
  await page.locator("#teacher-auth-form").getByRole("button", { name: /Anmelden|Öffnen/ }).click();
  await expect(page.locator("#password-overlay")).toBeVisible(); await expect(modal(page)).not.toBeVisible();
  await page.locator("#current-password-input").fill("TestPassword123!");
  await page.locator("#new-password-input").fill("ChangedPassword123!");
  await page.locator("#new-password-confirmation-input").fill("ChangedPassword123!");
  await page.locator("#password-save-button").click(); await expect(modal(page)).toBeVisible();
});
test("installed app waits until its splash is dismissed", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === "(display-mode: standalone)" ? { ...original(query), matches: true } : original(query);
  });
  await fixture(page); await page.goto("/teacher");
  await expect(page.locator("html")).toHaveClass(/pwa-splash-pending/); await expect(modal(page)).not.toBeVisible();
  await expect(modal(page)).toBeVisible(); await expect(page.locator("html")).not.toHaveClass(/pwa-splash-pending/);
  await expect(page.getByRole("button", { name: "Neuigkeiten schließen" })).toBeEnabled();
});
for (const [width, height, theme] of [[1024, 768, "dark"], [390, 720, "light"], [700, 380, "dark"]]) {
  test(`release highlights fit ${width} by ${height} in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(theme => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: theme })), theme);
    await fixture(page); await page.goto("/teacher"); await expect(modal(page)).toBeVisible();
    const rect = await modal(page).boundingBox(); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width); expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    await modal(page).getByRole("button", { name: "Weiter", exact: true }).scrollIntoViewIfNeeded();
    await expect(modal(page).getByRole("button", { name: "Weiter", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`whats-new-${width}-${theme}.png`) });
  });
}
