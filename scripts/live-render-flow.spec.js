const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "https://vocab-app-vea0.onrender.com";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";
const TEST_TABLET_ID = process.env.TEST_TABLET_ID || "blau-1";
const TEST_TABLET_PIN = process.env.TEST_TABLET_PIN || "1234";
const ALT_TEST_TABLET_ID = process.env.ALT_TEST_TABLET_ID || "pink-1";
const ALT_TEST_TABLET_PIN = process.env.ALT_TEST_TABLET_PIN || "5678";
const TEST_SET_PATH = process.env.TEST_SET_PATH || "sets/food-basics-01.json";
const TEACHER_PATH = "/teacher";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1366, height: 900 },
  colorScheme: "dark",
  locale: "de-DE",
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
  video: "retain-on-failure",
});

test.beforeEach(async ({ page }, testInfo) => {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push(`[${message.type()}] ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error?.stack || error?.message || String(error));
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "requestfailed"}`);
  });

  testInfo.annotations.push({ type: "baseURL", description: BASE_URL });
  testInfo.annotations.push({ type: "tablet", description: TEST_TABLET_ID });

  testInfo.attach("runtime-config", {
    body: JSON.stringify({
      BASE_URL,
      TEST_TABLET_ID,
      TEST_SET_PATH,
      teacherId: TEACHER_ID,
      hasTeacherPassword: Boolean(TEACHER_PASSWORD),
    }, null, 2),
    contentType: "application/json",
  });

  testInfo._liveErrors = { consoleMessages, pageErrors, failedRequests };
});

test.afterEach(async ({ page }, testInfo) => {
  const diagnostics = testInfo._liveErrors || {
    consoleMessages: [],
    pageErrors: [],
    failedRequests: [],
  };

  await testInfo.attach("browser-diagnostics", {
    body: JSON.stringify({
      title: await page.title().catch(() => ""),
      url: page.url(),
      consoleMessages: diagnostics.consoleMessages,
      pageErrors: diagnostics.pageErrors,
      failedRequests: diagnostics.failedRequests,
    }, null, 2),
    contentType: "application/json",
  });
});

test("public flow works and protected APIs stay locked", async ({ page, request }) => {
  const directoryResponse = await request.get("/api/tablet-directory");
  expect(directoryResponse.ok()).toBeTruthy();

  const directory = await directoryResponse.json();
  const tablet = Array.isArray(directory.tablets)
    ? directory.tablets.find((entry) => entry?.id === TEST_TABLET_ID)
    : null;

  expect(tablet).toBeTruthy();

  const protectedResponse = await request.get("/api/tablets");
  expect(protectedResponse.status()).toBe(401);

  await page.goto("/");
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");
  await expect(page.getByText("Weiterlernen")).toBeVisible();

  await page.goto(`${TEACHER_PATH}`);
  await expect(page.locator("#teacher-auth-title")).toHaveText("Anmelden");
  await expect(page.locator("#teacher-auth-panel")).toBeVisible();
  await expect(page.locator("#teacher-shell")).toBeHidden();
});

test("teacher login and tabs only show the active panel", async ({ page }) => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt fuer den Teacher-Login-Test.");

  await page.goto(TEACHER_PATH);
  await expect(page.locator("#teacher-auth-panel")).toBeVisible();
  await expect(page.locator("#teacher-shell")).toBeHidden();

  await page.locator("#teacher-account-select").selectOption(TEACHER_ID);
  await page.locator("#teacher-password-input").fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page.locator("#teacher-auth-panel")).toBeHidden();
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await expect(page.locator("#teacher-shell .teacher-header__title")).toHaveText("Lernsets");
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await expect(page.locator("#teacher-panel-tablets")).toBeHidden();

  await page.getByRole("tab", { name: "Tablets" }).click();
  await expect(page.locator("#teacher-shell .teacher-header__title")).toHaveText("Tablets");
  await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
  await expect(page.locator("#teacher-panel-sets")).toBeHidden();
});

test.describe("live mutation flow", () => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt fuer die Live-Mutationstests.");

  test("teacher login, registration, subscription, lockout and cleanup", async ({ page, request, browser }) => {
    test.setTimeout(120000);
    const teacherHeaders = await loginTeacher(page, request);
    await ensureTabletIsDecoupled(request, teacherHeaders, TEST_TABLET_ID);

    await page.goto("/");
    await registerTablet(page, TEST_TABLET_ID, TEST_TABLET_PIN);
    await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");

    await addSubscriptionViaUi(page, TEST_SET_PATH);

    await openFirstSet(page);
    await expect(page.locator("#flashcard")).toBeVisible();
    await page.reload();
    await expect(page.locator("#flashcard")).toBeVisible();
    await expect(page.getByText("Schon hinzugefügt.")).toHaveCount(0);
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await primeKnownTabletPage(freshPage, TEST_TABLET_ID);
    await freshPage.goto("/");
    await expect(freshPage.locator("#student-screen-title")).toContainText("Lerndeck");
    await quickLogin(freshPage, TEST_TABLET_PIN);
    await openFirstSet(freshPage);
    await expect(freshPage.locator("[data-star-button]")).toHaveCount(0);
    await freshContext.close();

    await ensureTabletIsDecoupled(request, teacherHeaders, TEST_TABLET_ID);

    const decoupledCheckContext = await browser.newContext();
    const decoupledCheckPage = await decoupledCheckContext.newPage();
    await primeKnownTabletPage(decoupledCheckPage, TEST_TABLET_ID);
    await decoupledCheckPage.goto("/");
    await expect(decoupledCheckPage.locator("#student-screen-title")).toContainText("Lerndeck");
    await expect(decoupledCheckPage.locator('input[name="pin-entry"]')).toBeVisible();
    await decoupledCheckPage.locator('input[name="pin-entry"]').fill(TEST_TABLET_PIN);
    await submitFormForField(decoupledCheckPage, 'input[name="pin-entry"]');
    await expect(decoupledCheckPage.getByText("Dieser Zugang ist auf diesem Tablet noch nicht eingerichtet.")).toBeVisible();
    await decoupledCheckContext.close();

    await registerTablet(page, TEST_TABLET_ID, TEST_TABLET_PIN);
    await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");

    const lockoutContext = await browser.newContext();
    const lockoutPage = await lockoutContext.newPage();
    await primeKnownTabletPage(lockoutPage, TEST_TABLET_ID);
    await lockoutPage.goto("/");
    await expect(lockoutPage.locator('input[name="pin-entry"]')).toBeVisible();
    await lockoutPage.locator('input[name="pin-entry"]').fill("0000");
    await submitFormForField(lockoutPage, 'input[name="pin-entry"]');
    await expect(lockoutPage.getByText(/PIN stimmt nicht.*Sekunden/i)).toBeVisible();
    await lockoutContext.close();

    await page.goto(TEACHER_PATH);
    await loginTeacher(page, request);
    await page.getByRole("tab", { name: "Tablets" }).click();
    const tabletRow = page.locator(".teacher-tablet-row", {
      has: page.getByText(TEST_TABLET_ID === "blau-1" ? "Blau 1" : TEST_TABLET_ID),
    });
    await expect(tabletRow.getByText(/Timeout/)).toBeVisible();
    await tabletRow.getByRole("button", { name: /Aktionen für/ }).click();
    await tabletRow.getByRole("menuitem", { name: "Freigabe aufheben" }).click();
    await expect(tabletRow.getByText(/Timeout/)).toHaveCount(0);

    const unlockedContext = await browser.newContext();
    const unlockedPage = await unlockedContext.newPage();
    await primeKnownTabletPage(unlockedPage, TEST_TABLET_ID);
    await unlockedPage.goto("/");
    await quickLogin(unlockedPage, TEST_TABLET_PIN);
    await expect(unlockedPage.locator("#student-screen-title")).toContainText("Lerndeck");
    await unlockedContext.close();

    await ensureTabletIsDecoupled(request, teacherHeaders, TEST_TABLET_ID);
  });

  test("known tablet can be cleared and replaced without updating local storage before login", async ({ page, request, browser }) => {
    test.setTimeout(120000);
    const teacherHeaders = await loginTeacher(page, request);

    await ensureTabletIsDecoupled(request, teacherHeaders, TEST_TABLET_ID);
    await ensureTabletIsDecoupled(request, teacherHeaders, ALT_TEST_TABLET_ID);

    await registerTablet(page, TEST_TABLET_ID, TEST_TABLET_PIN);
    await registerTablet(page, ALT_TEST_TABLET_ID, ALT_TEST_TABLET_PIN);

    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();
    await primeKnownTabletPage(loginPage, TEST_TABLET_ID);
    await loginPage.goto("/");

    await expect(loginPage.locator('input[name="pin-entry"]')).toBeVisible();
    await loginPage.getByRole("button", { name: "Anderes Gerät" }).click();
    await loginPage.getByRole("button", { name: /Weiterlernen/ }).click();
    await selectTabletOption(loginPage, ALT_TEST_TABLET_ID);

    await expect.poll(async () => loginPage.evaluate((deviceStorageKey) => {
      return window.localStorage.getItem(deviceStorageKey);
    }, DEVICE_STORAGE_KEY)).toBe(TEST_TABLET_ID);

    await loginPage.locator('input[name="pin-entry"]').fill(ALT_TEST_TABLET_PIN);
    await submitFormForField(loginPage, 'input[name="pin-entry"]');
    await expect(loginPage.locator("#student-screen-title")).toContainText("Lerndeck");

    await expect.poll(async () => loginPage.evaluate((deviceStorageKey) => {
      return window.localStorage.getItem(deviceStorageKey);
    }, DEVICE_STORAGE_KEY)).toBe(ALT_TEST_TABLET_ID);

    await loginContext.close();

    await ensureTabletIsDecoupled(request, teacherHeaders, TEST_TABLET_ID);
    await ensureTabletIsDecoupled(request, teacherHeaders, ALT_TEST_TABLET_ID);
  });
});

async function loginTeacher(page, request) {
  await page.goto(TEACHER_PATH);
  if (await page.locator("#teacher-auth-panel").isVisible()) {
    await expect(page.locator("#teacher-auth-title")).toHaveText("Anmelden");
    await page.locator("#teacher-account-select").selectOption(TEACHER_ID);
    await page.locator("#teacher-password-input").fill(TEACHER_PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
  }
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await expect(page.locator("#teacher-auth-panel")).toBeHidden();
  await expect(page.locator("#teacher-shell .teacher-header__title")).toHaveText("Lernsets");
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await expect(page.locator("#teacher-panel-tablets")).toBeHidden();

  await page.getByRole("tab", { name: "Tablets" }).click();
  await expect(page.locator("#teacher-shell .teacher-header__title")).toHaveText("Tablets");
  await expect(page.locator("#teacher-panel-tablets")).toBeVisible();
  await expect(page.locator("#teacher-panel-sets")).toBeHidden();

  await page.getByRole("tab", { name: "Lernsets" }).click();
  await expect(page.locator("#teacher-shell .teacher-header__title")).toHaveText("Lernsets");
  await expect(page.locator("#teacher-panel-sets")).toBeVisible();
  await expect(page.locator("#teacher-panel-tablets")).toBeHidden();

  const teacherLoginResponse = await request.post("/api/teacher/session", {
    data: { teacherId: TEACHER_ID, password: TEACHER_PASSWORD },
  });
  expect(teacherLoginResponse.ok()).toBeTruthy();
  return {};
}

async function ensureTabletIsDecoupled(request, headers, tabletId) {
  const response = await request.post(`/api/tablets/${encodeURIComponent(tabletId)}/decouple`, {
    headers,
  });

  expect(response.ok()).toBeTruthy();
}

async function registerTablet(page, tabletId, pin) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");
  await page.getByRole("button", { name: "Neu einrichten" }).click();
  await expect(page.getByRole("heading", { name: "Neu einrichten" })).toBeVisible();

  await selectTabletOption(page, tabletId);
  await page.locator('input[name="registration-pin"]').fill(pin);
  await page.locator('input[name="registration-pin-confirm"]').fill(pin);
  await submitFormForField(page, 'input[name="registration-pin-confirm"]');
  await expect(page.locator(".student-screen__home-actions")).toBeVisible();
}

async function quickLogin(page, pin) {
  await expect(page.locator('input[name="pin-entry"]')).toBeVisible();
  await page.locator('input[name="pin-entry"]').fill(pin);
  await submitFormForField(page, 'input[name="pin-entry"]');
  await expect(page.locator(".student-screen__home-actions")).toBeVisible();
}

async function addSubscriptionViaUi(page, setPath) {
  await page.goto(`/?set=${encodeURIComponent(setPath)}`);
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
}

async function openFirstSet(page) {
  const startButton = page.locator(".student-screen__library-card").first();
  await startButton.click();
  await page.locator("#launch-mode-start").click();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await page.locator("#launch-settings-start").click();
}

async function selectTabletOption(page, tabletId) {
  const nativeSelect = page.locator('select[name="tabletId"]');

  if (await nativeSelect.count()) {
    await nativeSelect.selectOption(tabletId);
    return;
  }

  const label = formatTabletLabel(tabletId);
  await page.getByRole("button", { name: label, exact: true }).click();
}

function formatTabletLabel(tabletId) {
  return tabletId
    .trim()
    .split("-")
    .filter(Boolean)
    .map((part) => (/^[0-9]+$/.test(part) ? part : `${part[0]?.toUpperCase() || ""}${part.slice(1)}`))
    .join(" ");
}

async function submitFormForField(page, fieldSelector) {
  const field = page.locator(fieldSelector);
  const form = field.locator("xpath=ancestor::form[1]");
  await form.getByRole("button", { name: "Starten" }).click();
}

async function primeKnownTabletPage(page, tabletId) {
  await page.addInitScript(({ deviceStorageKey, nextTabletId }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(deviceStorageKey, nextTabletId);
  }, {
    deviceStorageKey: DEVICE_STORAGE_KEY,
    nextTabletId: tabletId,
  });
}
