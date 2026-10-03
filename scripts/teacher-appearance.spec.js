const { test, expect } = require("playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createVocabularyPrintPdf } = require("../lib/print-service");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "teacher-appearance");
const STORAGE_KEY = "lerndeck-teacher-appearance-v1";
test.use({ baseURL: BASE_URL, viewport: { width: 1150, height: 850 }, locale: "de-DE", serviceWorkers: "block" });
test.beforeAll(() => fs.mkdir(OUTPUT_DIR, { recursive: true }));

async function mockTeacher(page) {
  const set = {
    id: "appearance-set", path: "sets/user/appearance-set.json", status: "published",
    title: "Unterwegs – Means of transport", subject: "Englisch", description: "Wörter für unsere nächste Reise",
    editable: true, deletable: true, ownerTeacherId: "julius", shareCode: "123456", cardCount: 6,
    sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch",
    cards: [ ["Zug", "train"], ["Fahrrad", "bicycle"], ["Bus", "bus"], ["zu Fuß", "on foot"], ["Haltestelle", "bus stop"], ["Fahrkarte", "ticket"] ]
      .map(([front, back], index) => ({ id: `card-${index}`, front, back, acceptedAnswers: [] })),
    tablets: [{ id: "blau-1", label: "Blau 1" }],
  };
  const teacher = { id: "julius", displayName: "Julius", role: "admin" };
  const responses = {
    "/api/runtime-info": { publicOrigin: BASE_URL },
    "/api/teacher/accounts": { accounts: [teacher] },
    "/api/teacher/session": { session: { teacherId: "julius" }, teacher },
    "/api/sets": { sets: [{ ...set, cards: undefined }], teacher, importConfigured: true, visualConfigured: true },
    "/api/tablets": { tablets: [
      { id: "blau-1", label: "Blau 1", registered: true, setCount: 1 },
      { id: "rot-1", label: "Rot 1", registered: false, setCount: 0 },
      { id: "pink-1", label: "Pink 1", registered: true, setCount: 0 },
    ] },
    "/api/teacher/visual-jobs": { jobs: [] },
    "/api/teacher/sets/appearance-set": { set },
    "/api/teacher/sets/appearance-set/visuals": { assets: [] },
  };
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/print")) {
      const body = await createVocabularyPrintPdf({ set, ...route.request().postDataJSON() });
      await route.fulfill({ contentType: "application/pdf", body });
    } else {
      await route.fulfill({ json: responses[pathname] || {} });
    }
  });
}

async function appearance(page) {
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Helles Design" })).toBeVisible();
}

async function capture(page, name) {
  // Let the existing surface animation settle before visual inspection.
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

for (const [mode, id, name] of [
  ["light", "linen", "Leinen"], ["dark", "navy", "Nachtblau"],
]) {
  test(`${name}: teacher workflows and responsive appearance`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await mockTeacher(page);
    await page.goto("/teacher");
    await expect(page.locator("#teacher-shell")).toBeVisible();
    await appearance(page);
    const toggle = page.getByRole("menuitemcheckbox", { name: "Helles Design" });
    if (mode === "light") await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", mode);
    await expect(toggle).toHaveAttribute("aria-checked", String(mode === "light"));
    await expect(page.locator("#teacher-appearance-overlay")).toHaveCount(0);
    await capture(page, `${id}-settings`);
    await page.keyboard.press("Escape");
    await expect(page.locator("#teacher-shell-icon")).toHaveCSS("filter", "none");
    await capture(page, `${id}-sets`);

    const contrast = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const luminance = (color) => {
        const values = color.trim().slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
          .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const background = luminance(css.getPropertyValue("--surface"));
      return ["--text", "--text-muted"].map((key) => {
        const text = luminance(css.getPropertyValue(key));
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      });
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);

    await page.locator("#teacher-section-toggle").click();

    await page.getByRole("menuitemradio", { name: "Tablets", exact: true }).click();
    await capture(page, `${id}-tablets`);
    await page.locator("#teacher-section-toggle").click();
    await page.getByRole("menuitemradio", { name: "Lernsets", exact: true }).click();
    await page.locator(".workspace-set-row").first().click();
    await expect(page.locator("#set-editor-form")).toBeVisible();
    await capture(page, `${id}-editor`);
    await page.locator("#workspace-print").click();
    await page.getByRole("button", { name: "Vokabeltest", exact: true }).click();
    await expect(page.locator("#print-paper")).toBeVisible();
    await expect(page.locator("#print-paper.print-paper, #print-paper .print-paper").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await capture(page, `${id}-print`);
    await page.keyboard.press("Escape");
    await expect(page.locator("#print-overlay")).toBeHidden();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", mode);

    await page.setViewportSize({ width: 390, height: 760 });
    await capture(page, `${id}-mobile`);
    await appearance(page);
    await capture(page, `${id}-settings-mobile`);
    const bounds = await page.locator("#teacher-settings-menu").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1024, height: 768 });
    await capture(page, `${id}-tablet`);
    await appearance(page);
    await capture(page, `${id}-settings-tablet`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
    await page.getByRole("menuitem", { name: "Passwort ändern" }).click();
    await expect(page.locator("#password-overlay")).toBeVisible();
    await capture(page, `${id}-password`);
    await page.keyboard.press("Escape");
    await expect(page.locator("#password-overlay")).toBeHidden();
    await page.getByRole("button", { name: "+ Neues Set", exact: true }).click();
    await page.getByRole("button", { name: "Importieren", exact: true }).click();
    await capture(page, `${id}-import`);
    await page.route("**/api/teacher/session", (route) => route.fulfill({ status: 401, json: {} }));
    await page.reload();
    await expect(page.locator("#teacher-auth-panel")).toBeVisible();
    await expect(page.locator(".teacher-auth__brand-icon")).toHaveCSS("filter", "none");
    await capture(page, `${id}-login`);
    expect(errors).toEqual([]);
  });
}

test("old teacher variants migrate to the two modes, independently of students", async ({ page }) => {
  await mockTeacher(page);
  await page.goto("/teacher");
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ mode: "light", light: "linen", dark: "forest" })), STORAGE_KEY);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", "light");
  await appearance(page);
  await page.getByRole("menuitemcheckbox", { name: "Helles Design" }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual({ mode: "dark" });
  await page.evaluate((key) => localStorage.setItem(key, "broken json"), STORAGE_KEY);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", "dark");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", "dark");
});

test("appearance remains usable when its browser storage is blocked", async ({ page }) => {
  await page.addInitScript((key) => {
    for (const method of ["getItem", "setItem"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (storageKey, ...args) {
        if (storageKey === key) throw new DOMException("Storage blocked", "SecurityError");
        return original.call(this, storageKey, ...args);
      };
    }
  }, STORAGE_KEY);
  await mockTeacher(page);
  await page.goto("/teacher");
  await appearance(page);
  await page.getByRole("menuitemcheckbox", { name: "Helles Design" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", "light");
});
