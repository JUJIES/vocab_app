const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "ui-screenshot-package-2026-04-06-device-pills");
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const SCREENSHOTS = [
  "01-student-access-entry.png",
  "02-student-access-entry-set-context.png",
  "03-student-access-continue-known-tablet.png",
  "04-student-access-setup-expanded.png",
  "05-student-home-menu.png",
  "06-student-add-set-screen.png",
  "07-student-launch-mode-modal.png",
  "08-student-flashcard-front.png",
  "09-student-flashcard-back.png",
  "10-teacher-set-list.png",
  "11-teacher-share-overlay.png",
  "12-student-home-set-added-highlight.png",
];

test.use({
  viewport: { width: 1366, height: 1024 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

async function preparePage(page, {
  pathname = "/index.html",
  setPath = "",
  localTabletId = "",
  sessionUnlocked = false,
} = {}) {
  await page.addInitScript((storage) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    if (storage.localTabletId) {
      window.localStorage.setItem(storage.deviceKey, storage.localTabletId);
    }

    if (storage.sessionUnlocked) {
      window.sessionStorage.setItem(storage.sessionKey, "1");
    }
  }, {
    localTabletId,
    sessionUnlocked,
    deviceKey: DEVICE_STORAGE_KEY,
    sessionKey: SESSION_UNLOCK_KEY,
  });

  const url = new URL(pathname, BASE_URL);
  if (setPath) {
    url.searchParams.set("set", setPath);
  }

  await page.goto(url.toString(), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.waitForTimeout(350);
}

async function capture(page, fileName) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    fullPage: true,
  });
}

test("01 access entry", async ({ page }) => {
  await preparePage(page);
  await expect(page.locator("#student-screen-title")).toHaveText("Lerndeck");
  await capture(page, SCREENSHOTS[0]);
});

test("02 access entry with set context", async ({ page }) => {
  await preparePage(page, {
    setPath: "sets/travel-basics-01.json",
  });
  await expect(page.locator("#student-screen-title")).toHaveText("Lerndeck");
  await capture(page, SCREENSHOTS[1]);
});

test("03 access continue known tablet", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
  });
  await expect(page.getByRole("heading", { name: "Weiterlernen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Anderes Gerät" })).toBeVisible();
  await capture(page, SCREENSHOTS[2]);
});

test("04 access setup expanded", async ({ page }) => {
  await preparePage(page);
  await page.getByRole("button", { name: "Neu einrichten" }).click();
  await expect(page.getByText("Nur für freie Tablets")).toBeVisible();
  await capture(page, SCREENSHOTS[3]);
});

test("05 student home menu", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
  });
  await expect(page.locator("#student-screen-title")).toHaveText("Lerndeck");
  await capture(page, SCREENSHOTS[4]);
});

test("06 student add set screen", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
  });
  await page.getByRole("button", { name: /Deck hinzufügen/i }).click();
  await expect(page.locator("#add-set-modal")).toBeVisible();
  await capture(page, SCREENSHOTS[5]);
});

test("07 student launch mode modal", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
  });
  await page.locator(".student-screen__library-action").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await capture(page, SCREENSHOTS[6]);
});

test("08 student flashcard front", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
  });
  await page.locator(".student-screen__library-action").first().click();
  await page.locator("#launch-mode-start").click();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await expect(page.locator("#flashcard")).toBeVisible();
  await expect(page.locator("#front-word")).not.toHaveText("");
  await capture(page, SCREENSHOTS[7]);
});

test("09 student flashcard back", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
  });
  await page.locator(".student-screen__library-action").first().click();
  await page.locator("#launch-mode-start").click();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await expect(page.locator("#flashcard")).toBeVisible();
  await page.locator("#flashcard").click();
  await expect(page.locator("#flashcard")).toHaveClass(/is-flipped/);
  await capture(page, SCREENSHOTS[8]);
});

test("10 teacher set list", async ({ page }) => {
  await preparePage(page, {
    pathname: "/teacher",
  });
  await expect(page.locator(".teacher-header__title")).toHaveText("Sets");
  await capture(page, SCREENSHOTS[9]);
});

test("11 teacher share overlay", async ({ page }) => {
  await preparePage(page, {
    pathname: "/teacher",
  });
  await page.getByRole("button", { name: "Teilen" }).first().click();
  await expect(page.locator("#share-overlay")).toBeVisible();
  await capture(page, SCREENSHOTS[10]);
});

test("12 student home set added highlight", async ({ page }) => {
  await preparePage(page, {
    localTabletId: "rot-1",
    sessionUnlocked: true,
    setPath: "sets/travel-basics-01.json",
  });
  await expect(page.locator(".student-screen__library-card.is-highlighted")).toBeVisible();
  await capture(page, SCREENSHOTS[11]);
});

test("13 contact sheet", async ({ page }) => {
  const htmlPath = path.join(OUTPUT_DIR, "00-contact-sheet.html");
  const cards = SCREENSHOTS.map((fileName) => `
    <figure class="card">
      <img src="${fileName}" alt="${fileName}" />
      <figcaption>${fileName}</figcaption>
    </figure>
  `).join("");

  const html = `<!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>UI Contact Sheet</title>
      <style>
        body {
          margin: 0;
          padding: 32px;
          background: #0f1420;
          color: #eef3ff;
          font-family: Manrope, system-ui, sans-serif;
        }
        h1 {
          margin: 0 0 24px;
          font-size: 28px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .card {
          margin: 0;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 14px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
        }
        figcaption {
          margin-top: 12px;
          font-size: 13px;
          color: rgba(238, 243, 255, 0.84);
        }
      </style>
    </head>
    <body>
      <h1>UI Contact Sheet</h1>
      <div class="grid">${cards}</div>
    </body>
  </html>`;

  await fs.writeFile(htmlPath, html, "utf8");
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1600, height: 7200 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "00-contact-sheet.png"),
    fullPage: true,
  });
});
