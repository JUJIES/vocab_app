const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.OUTPUT_DIR
  || path.join(process.cwd(), "artifacts", "student-home-ui-review-blau-2-2026-04-07");
const VIEWPORT = { width: 1366, height: 1024 };
const TABLET_ID = "blau-2";
const TABLET_PIN = "1111";

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function clearClientState(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function loginAsBlau2(page) {
  await clearClientState(page);
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Weiterlernen/i }).click();
  await page.locator('select[name="tabletId"]').selectOption(TABLET_ID);
  await page.locator('input[name="pin-entry"]').fill(TABLET_PIN);
  await page.locator('.student-screen__access-form--login button[type="submit"]').click();
  await page.locator("#student-screen-title").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const title = document.getElementById("student-screen-title");
    return title && title.textContent.trim() === "Lerndeck";
  });
  await page.waitForTimeout(500);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const rectData = (element) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        left: Number(rect.left.toFixed(2)),
      };
    };

    const header = document.querySelector(".student-screen__header");
    const grid = document.querySelector(".student-screen__library");
    const cards = Array.from(document.querySelectorAll(".student-screen__library-card"));
    const realCards = cards.filter((card) => !card.classList.contains("student-screen__library-card--add"));
    const addCard = cards.find((card) => card.classList.contains("student-screen__library-card--add")) || null;
    const slots = Array.from(document.querySelectorAll(".student-screen__library-slot"));
    const gridStyle = grid ? getComputedStyle(grid) : null;

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      page: {
        title: document.getElementById("student-screen-title")?.textContent?.trim() || "",
        message: document.getElementById("student-screen-message")?.textContent?.trim() || "",
      },
      header: {
        rect: rectData(header),
        title: document.getElementById("student-screen-title")?.textContent?.trim() || "",
        kicker: document.getElementById("student-screen-kicker")?.textContent?.trim() || "",
        message: document.getElementById("student-screen-message")?.textContent?.trim() || "",
        secondaryActionLabel: document.querySelector(".student-screen__action--secondary")?.textContent?.trim() || "",
      },
      library: {
        rect: rectData(grid),
        columnGap: gridStyle?.columnGap || "",
        rowGap: gridStyle?.rowGap || "",
        templateColumns: gridStyle?.gridTemplateColumns || "",
        cardCount: realCards.length,
        slotCount: slots.length,
        includesAddCard: Boolean(addCard),
      },
      cards: realCards.map((card, index) => {
        const title = card.querySelector(".student-screen__library-cover-title")?.textContent?.trim() || "";
        const meta = card.querySelector(".student-screen__library-meta")?.textContent?.trim() || "";
        const description = card.querySelector(".student-screen__library-description")?.textContent?.trim() || "";
        const badge = card.querySelector(".student-screen__library-badge-label")?.textContent?.trim() || "";
        const learnButton = card.querySelector(".student-screen__library-action");
        const menuButton = card.querySelector(".student-screen__library-menu-toggle");
        const colorButton = card.querySelector(".student-screen__library-color-toggle");
        const descriptionEl = card.querySelector(".student-screen__library-description");

        return {
          index,
          title,
          badge,
          meta,
          description,
          rect: rectData(card),
          controls: {
            learnButtonWidth: learnButton ? Number(learnButton.getBoundingClientRect().width.toFixed(2)) : 0,
            menuButtonWidth: menuButton ? Number(menuButton.getBoundingClientRect().width.toFixed(2)) : 0,
            colorButtonWidth: colorButton ? Number(colorButton.getBoundingClientRect().width.toFixed(2)) : 0,
          },
          text: {
            titleLength: title.length,
            descriptionLength: description.length,
            descriptionClientHeight: descriptionEl ? Number(descriptionEl.clientHeight.toFixed(2)) : 0,
            descriptionScrollHeight: descriptionEl ? Number(descriptionEl.scrollHeight.toFixed(2)) : 0,
            descriptionIsClipped: descriptionEl ? descriptionEl.scrollHeight > descriptionEl.clientHeight + 1 : false,
          },
        };
      }),
      addCard: addCard
        ? {
          rect: rectData(addCard),
          title: addCard.querySelector(".student-screen__library-add-title")?.textContent?.trim() || "",
          text: addCard.querySelector(".student-screen__library-add-text")?.textContent?.trim() || "",
        }
        : null,
      slots: slots.map((slot, index) => ({
        index,
        rect: rectData(slot),
      })),
    };
  });
}

async function saveJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: VIEWPORT,
    colorScheme: "dark",
    locale: "de-DE",
  });

  try {
    await loginAsBlau2(page);

    const metrics = await collectMetrics(page);
    await saveJson(path.join(OUTPUT_DIR, "metrics.json"), metrics);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "01-home-overall.png"),
      fullPage: true,
    });

    await page.locator(".student-screen__header").screenshot({
      path: path.join(OUTPUT_DIR, "02-home-header-hud.png"),
    });

    await page.locator(".student-screen__library").screenshot({
      path: path.join(OUTPUT_DIR, "03-home-grid.png"),
    });

    const cardLocators = page.locator(".student-screen__library-card");
    const cardCount = await cardLocators.count();
    const cardFiles = [];

    for (let index = 0; index < cardCount; index += 1) {
      const locator = cardLocators.nth(index);
      const isAddCard = await locator.evaluate((node) => node.classList.contains("student-screen__library-card--add"));
      const title = isAddCard
        ? "add-card"
        : await locator.locator(".student-screen__library-cover-title").textContent();
      const fileName = `${String(index + 4).padStart(2, "0")}-card-${slugify(title || "card")}.png`;
      await locator.screenshot({
        path: path.join(OUTPUT_DIR, fileName),
      });
      cardFiles.push(fileName);
    }

    const slotLocators = page.locator(".student-screen__library-slot");
    const slotCount = await slotLocators.count();
    const slotFiles = [];

    for (let index = 0; index < slotCount; index += 1) {
      const fileName = `${String(index + 4 + cardCount).padStart(2, "0")}-slot-empty-${index + 1}.png`;
      await slotLocators.nth(index).screenshot({
        path: path.join(OUTPUT_DIR, fileName),
      });
      slotFiles.push(fileName);
    }

    await saveJson(path.join(OUTPUT_DIR, "captures.json"), {
      baseUrl: BASE_URL,
      viewport: VIEWPORT,
      tabletId: TABLET_ID,
      captures: [
        "01-home-overall.png",
        "02-home-header-hud.png",
        "03-home-grid.png",
        ...cardFiles,
        ...slotFiles,
      ],
    });

    console.log(JSON.stringify({
      outputDir: OUTPUT_DIR,
      cardFiles,
      slotFiles,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
