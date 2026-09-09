const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, colorScheme: "dark", locale: "de-DE" });

test("admin sees own sets separately and can expand another teacher's sets", async ({ page }) => {
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

  await page.goto("/teacher", { waitUntil: "networkidle" });
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(page.getByText("1 eigene · 1 von anderen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mein Set" })).toBeVisible();

  const ownerGroup = page.locator("details.teacher-managed-owner");
  await expect(ownerGroup).not.toHaveAttribute("open", "");
  await expect(page.getByRole("heading", { name: "Zoom in" })).not.toBeVisible();
  await ownerGroup.locator("summary").click();
  await expect(page.getByRole("heading", { name: "Zoom in" })).toBeVisible();

  const managedRow = page.locator(".teacher-set-row", { hasText: "Zoom in" });
  await expect(managedRow.getByRole("button", { name: "Set Zoom in bearbeiten" })).toBeVisible();
  await expect(managedRow.getByRole("button", { name: "Set Zoom in löschen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Set Mein Set löschen" })).toBeVisible();
});
