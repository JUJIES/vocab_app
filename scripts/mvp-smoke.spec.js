const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";
const TEST_TABLET_ID = process.env.TEST_TABLET_ID || "blau-1";
const TEST_TABLET_PIN = process.env.TEST_TABLET_PIN || "1234";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
});

test("Monday MVP: teacher draft, stable code, tablet subscription and correction loop", async ({ page, request }) => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den isolierten Mutationstest.");

  const teacherLogin = await request.post("/api/teacher/session", {
    data: { teacherId: TEACHER_ID, password: TEACHER_PASSWORD },
  });
  expect(teacherLogin.ok()).toBeTruthy();

  const decoupleTablet = async () => {
    const response = await request.post(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/decouple`);
    expect(response.ok()).toBeTruthy();
  };

  await decoupleTablet();

  try {
    const importResponse = await request.post("/api/teacher/import-draft", {
      data: { text: "Hund; dog\nKatze; cat\nVogel; bird" },
    });
    expect(importResponse.ok()).toBeTruthy();
    const draft = (await importResponse.json()).draft;
    const localizedDraft = {
      ...draft,
      sourceLabel: "Deutsch",
      targetLabel: "Englisch",
    };

    const createResponse = await request.post("/api/teacher/sets", {
      data: { ...localizedDraft, title: "MVP Smoke Tiere" },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdSet = (await createResponse.json()).set;
    expect(createdSet.shareCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const updateResponse = await request.put(`/api/teacher/sets/${createdSet.id}`, {
      data: { ...localizedDraft, title: "MVP Smoke Tiere live" },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updatedSet = (await updateResponse.json()).set;
    expect(updatedSet.shareCode).toBe(createdSet.shareCode);
    expect(updatedSet.path).toBe(createdSet.path);

    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Neu einrichten/ }).click();
    await page.locator('select[name="tabletId"]').selectOption(TEST_TABLET_ID);
    await page.locator('input[name="registration-pin"]').fill(TEST_TABLET_PIN);
    await page.locator('input[name="registration-pin-confirm"]').fill(TEST_TABLET_PIN);
    await page.getByRole("button", { name: "Starten" }).click();
    await expect(page.locator(".student-screen__home-actions")).toBeVisible();

    await page.goto(`/?code=${createdSet.shareCode}`, { waitUntil: "networkidle" });
    const setCard = page.getByRole("button", { name: /MVP Smoke Tiere live/ });
    await expect(setCard).toBeVisible();
    await setCard.click();
    await page.getByRole("button", { name: "Üben starten" }).click();
    await expect(page.locator("#launch-settings-modal")).toBeVisible();
    await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="target-source"]').click();
    await page.locator("#launch-settings-start").click();
    await expect(page.locator("#front-word")).toHaveText(/^(dog|cat|bird)$/);
    await page.locator("#student-home-link").click();
    await expect(setCard).toBeVisible();

    await setCard.click();
    await page.locator('.launch-mode-modal__mode-card[data-mode-key="write"]').click();
    await page.getByRole("button", { name: "Eingabe starten" }).click();
    await expect(page.locator("#launch-settings-modal")).toBeVisible();
    await expect(page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]')).toHaveAttribute(
      "aria-label",
      "Deutsch zuerst, danach Englisch",
    );
    await expect(page.locator('[data-learning-direction-group="launch"] [data-learning-direction="target-source"]')).toHaveAttribute(
      "aria-label",
      "Englisch zuerst, danach Deutsch",
    );
    await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
    await page.locator("#launch-settings-start").click();

    const answer = page.getByPlaceholder("Antwort eingeben");
    const prompt = page.locator("#input-prompt-word");
    await expect(prompt).toHaveText("Hund");
    await page.locator("#input-settings-button").click();
    await page.locator('[data-learning-direction-group="input"] [data-learning-direction="target-source"]').click();
    await expect(prompt).toHaveText("dog");
    await page.locator("#input-settings-button").click();
    await page.locator('[data-learning-direction-group="input"] [data-learning-direction="source-target"]').click();
    await expect(prompt).toHaveText("Hund");
    await answer.fill("falsch");
    await page.getByRole("button", { name: "Antwort prüfen" }).click();
    await expect(page.getByText("Noch nicht korrekt", { exact: true })).toBeVisible();
    await answer.fill("dog");
    await page.getByRole("button", { name: "Antwort noch einmal eingeben" }).click();
    await expect(page.getByText("Korrigiert", { exact: true })).toBeVisible();

    const healthResponse = await request.get("/health");
    expect(healthResponse.ok()).toBeTruthy();
    await expect(healthResponse.json()).resolves.toMatchObject({ status: "ok", service: "lerndeck" });
  } finally {
    await decoupleTablet();
  }
});
