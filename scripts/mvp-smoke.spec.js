const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_PIN = process.env.TEACHER_PIN || "";
const TEST_TABLET_ID = process.env.TEST_TABLET_ID || "blau-1";
const TEST_TABLET_PIN = process.env.TEST_TABLET_PIN || "1234";
const TEST_SET_PATH = process.env.TEST_SET_PATH || "sets/food-basics-01.json";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
});

test("Monday MVP: register, add a set, learn and keep progress API protected", async ({ page, request }) => {
  test.skip(!TEACHER_PIN, "TEACHER_PIN fehlt für den isolierten Mutationstest.");

  const teacherLogin = await request.post("/api/teacher/session", {
    data: { pin: TEACHER_PIN },
  });
  expect(teacherLogin.ok()).toBeTruthy();
  const teacherToken = (await teacherLogin.json())?.session?.token;
  expect(teacherToken).toBeTruthy();
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

  const decoupleTablet = async () => {
    const response = await request.post(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/decouple`, {
      headers: teacherHeaders,
    });
    expect(response.ok()).toBeTruthy();
  };

  await decoupleTablet();

  try {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("#student-screen-title")).toHaveText("Lerndeck");
    await page.getByRole("button", { name: "Neu einrichten" }).click();
    await page.locator('select[name="tabletId"]').selectOption(TEST_TABLET_ID);
    await page.locator('input[name="registration-pin"]').fill(TEST_TABLET_PIN);
    await page.locator('input[name="registration-pin-confirm"]').fill(TEST_TABLET_PIN);
    await page.locator('input[name="registration-pin-confirm"]')
      .locator("xpath=ancestor::form[1]")
      .getByRole("button", { name: "Starten" })
      .click();
    await expect(page.locator(".student-screen__home-actions")).toBeVisible();

    await page.goto(`/?set=${encodeURIComponent(TEST_SET_PATH)}`, { waitUntil: "networkidle" });
    const firstSet = page.locator(".student-screen__library-card").first();
    await expect(firstSet).toBeVisible();
    await firstSet.click();
    await expect(page.locator("#launch-mode-modal")).toBeVisible();
    await page.locator("#launch-mode-start").click();
    await expect(page.locator("#flashcard")).toBeVisible();
    await expect(page.locator("#front-word")).not.toHaveText("");

    const protectedResponse = await request.get(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/subscriptions`);
    expect(protectedResponse.status()).toBe(401);

    const healthResponse = await request.get("/health");
    expect(healthResponse.ok()).toBeTruthy();
    await expect(healthResponse.json()).resolves.toMatchObject({ status: "ok", service: "lerndeck" });
  } finally {
    await decoupleTablet();
  }
});
