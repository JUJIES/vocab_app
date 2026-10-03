const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, colorScheme: "dark", locale: "de-DE" });

test("admin explicitly chooses an owner library without inheriting deletion rights", async ({ page }) => {
  await page.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [
      { id: "julius", displayName: "Julius", role: "admin" },
      { id: "aksana", displayName: "Aksana", role: "teacher" },
    ] },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius", role: "admin" } },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: {
      teacher: { id: "julius", displayName: "Julius", role: "admin" },
      importConfigured: true,
      visualConfigured: true,
      sets: [
        {
          id: "own-set", path: "sets/user/own-set.json", title: "Mein Set", status: "published",
          ownerTeacherId: "julius", ownerDisplayName: "Julius", editable: true, deletable: true, cards: [], tablets: [],
        },
        {
          id: "aksana-set", path: "sets/user/aksana-set.json", title: "Zoom in", status: "published",
          ownerTeacherId: "aksana", ownerDisplayName: "Aksana", managedByAdmin: true,
          editable: true, deletable: false, cardCount: 18, tablets: [],
        },
      ],
    },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));

  await page.route("**/api/teacher/sets/*", route => route.fulfill({ json: { set: {
    id: "aksana-set", path: "sets/user/aksana-set.json", title: "Zoom in", status: "published",
    ownerTeacherId: "aksana", editable: true, deletable: false, cards: [],
  } } }));
  await page.goto("/teacher", { waitUntil: "networkidle" });
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set Mein Set öffnen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set Zoom in öffnen" })).toHaveCount(0);
  await page.getByLabel("Bibliothek der Lehrkraft").selectOption("aksana");
  await page.getByRole("button", { name: "Set Zoom in öffnen" }).click();
  await expect(page.locator("#workspace-delete")).toBeHidden();
  await expect(page.locator("#set-unit-input")).toBeDisabled();
  await expect(page.locator("#create-set-button")).toBeHidden();
  await page.getByLabel("Bibliothek der Lehrkraft").selectOption("julius");
  await expect(page.getByRole("button", { name: "Set Mein Set öffnen" })).toBeVisible();
});
