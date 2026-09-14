const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
  colorScheme: "dark",
  locale: "de-DE",
});

test("student can change a mistakenly selected tablet after a wrong PIN", async ({ page }, testInfo) => {
  await page.route("**/api/tablet-directory", (route) => route.fulfill({ json: {
    tablets: [
      { id: "blau-1", label: "Blau 1", registered: true },
      { id: "blau-2", label: "Blau 2", registered: true },
    ],
  } }));
  await page.route("**/api/access-session", (route) => route.fulfill({ json: {
    accessSession: { tabletId: "", failureCount: 0, isBound: false, isCoolingDown: false, remainingMs: 0 },
  } }));
  let verifyCalls = 0;
  await page.route("**/api/tablets/blau-1/verify-pin", (route) => {
    verifyCalls += 1;
    return route.fulfill({
    status: 429,
    json: {
      error: "PIN stimmt nicht. 1 Sekunde und versuche es dann erneut.",
      accessSession: {
        tabletId: "blau-1",
        failureCount: 1,
        isBound: true,
        isCoolingDown: true,
        lockedUntil: new Date(Date.now() + 2000).toISOString(),
        remainingMs: 2000,
      },
    },
    });
  });
  let switchCalls = 0;
  await page.route("**/api/tablets/switch-selection", (route) => {
    switchCalls += 1;
    return route.fulfill({ json: {
      accessSession: { tabletId: "", failureCount: 1, isBound: false, isCoolingDown: false, remainingMs: 0 },
    } });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Weiterlernen/ }).click();
  await expect(page.locator('select[name="tabletId"]')).toHaveValue("");
  const pinInput = page.locator('input[name="pin-entry"]');
  await pinInput.fill("5678");
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByText("Bitte wähle ein Tablet aus.")).toBeVisible();
  await expect(pinInput).toHaveValue("5678");
  expect(verifyCalls).toBe(0);
  await page.locator('select[name="tabletId"]').selectOption("blau-1");
  await pinInput.fill("passwort");
  await expect(pinInput).toHaveValue("");
  await expect(page.getByText("Nur Ziffern eingeben.")).toBeVisible();
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByText("PIN: 4 bis 8 Ziffern eingeben.")).toBeVisible();
  expect(verifyCalls).toBe(0);
  await pinInput.fill("5678");
  await page.getByRole("button", { name: "Starten" }).click();
  expect(verifyCalls).toBe(1);

  const switchButton = page.getByRole("button", { name: "Tablet wechseln" });
  await expect(page.locator('select[name="tabletId-display"]')).toBeDisabled();
  await expect(switchButton).toBeDisabled();
  await expect(switchButton).toBeEnabled({ timeout: 5000 });
  await page.screenshot({ path: testInfo.outputPath("tablet-switch-ready.png"), fullPage: true });
  await switchButton.click();

  await expect(page.locator('select[name="tabletId"]')).toBeEnabled();
  await page.locator('select[name="tabletId"]').selectOption("blau-2");
  await expect(page.locator('select[name="tabletId"]')).toHaveValue("blau-2");
  expect(switchCalls).toBe(1);
});

test("tablet setup requires a deliberate device choice and a numeric PIN", async ({ page }) => {
  let registrationCalls = 0;
  await page.route("**/api/tablet-directory", (route) => route.fulfill({ json: {
    tablets: [{ id: "blau-1", label: "Blau 1", registered: false }],
  } }));
  await page.route("**/api/access-session", (route) => route.fulfill({ json: {
    accessSession: { tabletId: "", failureCount: 0, isBound: false, isCoolingDown: false, remainingMs: 0 },
  } }));
  await page.route("**/api/tablets/blau-1/register", (route) => {
    registrationCalls += 1;
    return route.fulfill({ status: 500, json: { error: "Testregistrierung" } });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Neu einrichten/ }).click();
  const tabletPicker = page.locator('select[name="tabletId"]');
  const pinInput = page.locator('input[name="registration-pin"]');
  await expect(tabletPicker).toHaveValue("");
  await expect(pinInput).toHaveAttribute("inputmode", "numeric");
  await pinInput.fill("passwort");
  await expect(pinInput).toHaveValue("");
  await expect(page.getByText("Nur Ziffern eingeben.")).toBeVisible();
  await pinInput.fill("1234");
  await page.locator('input[name="registration-pin-confirm"]').fill("1234");
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByText("Bitte wähle ein Tablet aus.")).toBeVisible();
  await expect(pinInput).toHaveValue("1234");
  expect(registrationCalls).toBe(0);
  await tabletPicker.selectOption("blau-1");
  await pinInput.fill("123");
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByText("PIN: 4 bis 8 Ziffern eingeben.")).toBeVisible();
  expect(registrationCalls).toBe(0);
});

test("login does not preselect the only registered tablet", async ({ page }) => {
  await page.route("**/api/tablet-directory", (route) => route.fulfill({ json: {
    tablets: [{ id: "blau-1", label: "Blau 1", registered: true }],
  } }));
  await page.route("**/api/access-session", (route) => route.fulfill({ json: {
    accessSession: { tabletId: "", failureCount: 0, isBound: false, isCoolingDown: false, remainingMs: 0 },
  } }));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Weiterlernen/ }).click();
  await expect(page.locator('select[name="tabletId"]')).toHaveValue("");
  await expect(page.locator('select[name="tabletId"] option:checked')).toHaveText("Tablet auswählen");
});
