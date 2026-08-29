const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "title-color-variants-2026-04-08");
const TABLET_ID = "blau-2";
const TABLET_PIN = "1111";

const VARIANTS = [
  {
    slug: "00-current-f4f7ff",
    label: "Current #F4F7FF",
    cssValue: "#f4f7ff",
  },
  {
    slug: "01-pure-white",
    label: "Pure White #FFFFFF",
    cssValue: "#ffffff",
  },
  {
    slug: "02-blue-soft",
    label: "Soft Blue #E6EAF0",
    cssValue: "#E6EAF0",
  },
  {
    slug: "03-neutral-soft",
    label: "Neutral Soft #F1F3F5",
    cssValue: "#F1F3F5",
  },
  {
    slug: "04-dimmed-white",
    label: "Dimmed White rgba(255,255,255,0.9)",
    cssValue: "rgba(255,255,255,0.9)",
  },
];

async function preparePage(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto(`${BASE_URL}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.getByRole("button", { name: /Weiterlernen/i }).click();
  await page.locator('select[name="tabletId"]').selectOption(TABLET_ID);
  await page.locator('input[name="pin-entry"]').fill(TABLET_PIN);
  await page.locator('.student-screen__access-form--login button[type="submit"]').click();
  await page.locator(".student-screen__library").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const appShell = document.querySelector(".app-shell");
    return appShell?.getAttribute("data-app-mode") === "home";
  });
  await page.waitForTimeout(450);
}

async function applyVariant(page, variant) {
  await page.evaluate(({ cssValue, label }) => {
    const styleId = "title-color-variant-style";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.append(style);
    }

    style.textContent = `
      .app-shell[data-app-mode="home"] .student-screen__title {
        color: ${cssValue};
      }
    `;

    document.documentElement.setAttribute("data-title-color-variant", label);
  }, variant);

  await page.waitForTimeout(120);
}

async function captureVariant(page, variant) {
  await applyVariant(page, variant);

  const header = page.locator(".student-screen__header");
  await header.screenshot({
    path: path.join(OUTPUT_DIR, `${variant.slug}.png`),
  });
}

async function createContactSheet() {
  const cards = VARIANTS.map((variant) => `
    <figure class="card">
      <div class="meta">
        <strong>${variant.label}</strong>
        <span>${variant.cssValue}</span>
      </div>
      <img src="${variant.slug}.png" alt="${variant.label}" />
    </figure>
  `).join("");

  const html = `<!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>Title Color Variants</title>
      <style>
        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 28px;
          background:
            radial-gradient(circle at top, rgba(57, 71, 101, 0.35), transparent 30%),
            linear-gradient(180deg, #121824 0%, #0e141d 100%);
          color: #eef3fb;
          font-family: Manrope, system-ui, sans-serif;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 28px;
        }

        p {
          margin: 0 0 24px;
          color: rgba(238, 243, 251, 0.72);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 18px;
        }

        .card {
          margin: 0;
          padding: 14px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
        }

        .meta {
          display: grid;
          gap: 4px;
          margin-bottom: 12px;
        }

        .meta strong {
          font-size: 15px;
        }

        .meta span {
          color: rgba(238, 243, 251, 0.68);
          font-size: 13px;
        }

        img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 16px;
        }
      </style>
    </head>
    <body>
      <h1>Header Title Variants</h1>
      <p>Home-Ansicht, gleicher UI-Zustand, nur die Titel-Farbe wurde verändert.</p>
      <div class="grid">${cards}</div>
    </body>
  </html>`;

  await fs.writeFile(path.join(OUTPUT_DIR, "index.html"), html, "utf8");
}

async function captureContactSheet(browser) {
  const page = await browser.newPage({
    viewport: { width: 1560, height: 2200 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    locale: "de-DE",
  });

  await page.goto(`file://${path.join(OUTPUT_DIR, "index.html")}`, { waitUntil: "load" });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "contact-sheet.png"),
    fullPage: true,
  });
  await page.close();
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      locale: "de-DE",
    });

    await preparePage(page);

    for (const variant of VARIANTS) {
      await captureVariant(page, variant);
    }

    await page.close();
    await createContactSheet();
    await captureContactSheet(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
