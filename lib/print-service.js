const PDFDocument = require("pdfkit");

const PAGE = Object.freeze({
  width: 595.28,
  height: 841.89,
  margin: 39.69,
});
const PRINT_KINDS = new Set(["list", "test"]);
const PRINT_DIRECTIONS = new Set(["source-target", "target-source"]);

class PrintRequestError extends Error {
  constructor(message, status = 400, code = "INVALID_PRINT_REQUEST") {
    super(message);
    this.name = "PrintRequestError";
    this.status = status;
    this.code = code;
  }
}

async function createVocabularyPrintPdf({ set, kind, direction, cardIds, className }) {
  const input = normalizePrintInput({ set, kind, direction, cardIds, className });
  const document = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    info: {
      Title: `${input.kind === "test" ? "Vokabeltest" : "Vokabelliste"} – ${input.title}`,
      Author: "Lerndeck",
      Creator: "Lerndeck",
    },
  });
  const chunks = [];
  const completion = new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  if (input.kind === "test") {
    renderVocabularyTest(document, input);
  } else {
    renderVocabularyList(document, input);
  }

  addPageNumbers(document);
  document.end();
  return completion;
}

function normalizePrintInput({ set, kind, direction, cardIds, className }) {
  if (!set || !Array.isArray(set.cards)) {
    throw new PrintRequestError("Set konnte nicht gedruckt werden.", 404, "PRINT_SET_NOT_FOUND");
  }

  const normalizedKind = typeof kind === "string" ? kind.trim() : "";
  if (!PRINT_KINDS.has(normalizedKind)) {
    throw new PrintRequestError("Druckart ist ungültig.");
  }

  const normalizedDirection = typeof direction === "string" ? direction.trim() : "";
  if (!PRINT_DIRECTIONS.has(normalizedDirection)) {
    throw new PrintRequestError("Abfragerichtung ist ungültig.");
  }

  const availableCards = new Map(set.cards.map((card) => [String(card.id), card]));
  const requestedCardIds = Array.isArray(cardIds) ? cardIds.map((id) => String(id)) : [];
  if (requestedCardIds.length === 0) {
    throw new PrintRequestError("Wähle mindestens eine Vokabel aus.", 400, "PRINT_CARDS_EMPTY");
  }
  if (requestedCardIds.length > 500) {
    throw new PrintRequestError("Es können höchstens 500 Vokabeln gedruckt werden.");
  }
  if (new Set(requestedCardIds).size !== requestedCardIds.length) {
    throw new PrintRequestError("Eine Vokabel wurde mehrfach ausgewählt.");
  }

  const cards = requestedCardIds.map((id) => {
    const card = availableCards.get(id);
    if (!card) {
      throw new PrintRequestError("Eine ausgewählte Vokabel gehört nicht zu diesem Set.");
    }
    return {
      id,
      source: cleanText(card.front, 500),
      target: cleanText(card.back, 1000),
    };
  });

  const sourceLabel = cleanText(set.sourceLabel, 80) || languageLabel(set.sourceLanguage, "Vorderseite");
  const targetLabel = cleanText(set.targetLabel, 80) || languageLabel(set.targetLanguage, "Rückseite");
  const sourceFirst = normalizedDirection === "source-target";

  return {
    kind: normalizedKind,
    direction: normalizedDirection,
    title: cleanText(set.title, 160) || "Lernset",
    subject: cleanText(set.subject, 120),
    className: cleanText(className, 80),
    leftLabel: sourceFirst ? sourceLabel : targetLabel,
    rightLabel: sourceFirst ? targetLabel : sourceLabel,
    cards: cards.map((card) => ({
      ...card,
      prompt: sourceFirst ? card.source : card.target,
      answer: sourceFirst ? card.target : card.source,
    })),
  };
}

function renderVocabularyTest(document, input) {
  const rowLayout = measureTestRows(document, input.cards);
  const pages = paginateRows(rowLayout, 213, 725);

  pages.forEach((rows, pageIndex) => {
    addA4Page(document);
    drawTestHeader(document, input, pageIndex);
    let y = 213;
    for (const row of rows) {
      drawTestRow(document, row, y);
      y += row.height;
    }
    if (pageIndex === pages.length - 1) {
      drawTestScoreFooter(document);
    }
  });
}

function drawTestHeader(document, input, pageIndex) {
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;

  document.fillColor("#111111").font("Helvetica-Bold").fontSize(8.5)
    .text("VOKABELTEST", left, 42, { characterSpacing: 1.6 });
  document.font("Times-Bold").fontSize(16)
    .text(input.className ? `Klasse: ${input.className}` : "Klasse: ____________________", left, 63, {
      width: 300,
      lineBreak: false,
    });
  document.font("Helvetica").fontSize(8).fillColor("#4b4b4b")
    .text(input.title, left, 88, { width: 300, ellipsis: true, lineBreak: false });

  document.lineWidth(0.75).strokeColor("#6c6c6c").roundedRect(right - 183, 42, 183, 66, 2).stroke();
  document.fillColor("#111111").font("Helvetica").fontSize(9)
    .text("Name:", right - 172, 57, { lineBreak: false })
    .text("Datum:", right - 172, 84, { lineBreak: false });
  document.moveTo(right - 132, 67).lineTo(right - 10, 67).strokeColor("#777777").lineWidth(0.5).stroke();
  document.moveTo(right - 132, 94).lineTo(right - 10, 94).stroke();

  document.fillColor("#4b4b4b").font("Helvetica-Bold").fontSize(6.5)
    .text("ARBEITSAUFTRAG", left, 132, { characterSpacing: 1, lineBreak: false });
  document.fillColor("#111111").font("Times-Roman").fontSize(10.5)
    .text(
      pageIndex === 0
        ? buildTestInstruction()
        : "Setze den Vokabeltest auf dieser Seite fort.",
      left,
      142,
      { width: right - left },
    );

  document.fillColor("#f4f4f4").rect(left, 174, right - left, 16).fill();
  document.fillColor("#111111").font("Helvetica-Bold").fontSize(7.5)
    .text("BEGRIFF", left + 22, 179, { characterSpacing: 0.8, lineBreak: false })
    .text("ANTWORT", left + 202, 179, { characterSpacing: 0.8, lineBreak: false });
}

function measureTestRows(document, cards) {
  document.font("Times-Roman").fontSize(11.5);
  return cards.map((card, index) => ({
    ...card,
    number: index + 1,
    height: Math.max(30, Math.ceil((document.heightOfString(card.prompt, {
      width: 145,
      lineGap: 1,
    }) + 12) * 1.15)),
  }));
}

function drawTestRow(document, row, y) {
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const baselineY = y + Math.min(row.height - 8, 17);

  document.fillColor("#111111").font("Helvetica").fontSize(8.5)
    .text(`${row.number}.`, left + 8, y + 9, { width: 22, align: "right", lineBreak: false });
  document.font("Times-Roman").fontSize(11.5)
    .text(row.prompt, left + 38, y + 7, {
      width: 145,
      height: Math.max(12, row.height - 10),
      lineGap: 1,
      ellipsis: true,
  });
  document.moveTo(left + 202, baselineY).lineTo(right - 10, baselineY)
    .strokeColor("#777777").lineWidth(0.55).stroke();
}

function drawTestScoreFooter(document) {
  const y = 758;
  const gap = 8;
  const width = (PAGE.width - (2 * PAGE.margin) - (2 * gap)) / 3;
  ["Punkte", "Prozent", "Note"].forEach((label, index) => {
    const x = PAGE.margin + (index * (width + gap));
    document.fillColor("#111111").font("Helvetica-Bold").fontSize(9)
      .text(`${label}:`, x, y, { characterSpacing: 0.2, lineBreak: false });
    const labelWidth = document.widthOfString(`${label}:`);
    document.moveTo(x + labelWidth + 7, y + 11).lineTo(x + width, y + 11)
      .strokeColor("#aaaaaa").lineWidth(0.4).stroke();
  });
}

function buildTestInstruction() {
  return "Übersetze die folgenden Begriffe in die jeweils korrekte Sprache. Formuliere vollständig und achte auf saubere Schrift.";
}

function renderVocabularyList(document, input) {
  const rows = measureListRows(document, input.cards);
  const pages = paginateRows(rows, 151, 782);

  pages.forEach((pageRows, pageIndex) => {
    addA4Page(document);
    drawListHeader(document, input, pageIndex);
    let y = 151;
    for (const row of pageRows) {
      drawListRow(document, row, y);
      y += row.height;
    }
  });
}

function drawListHeader(document, input, pageIndex) {
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  document.fillColor("#111111").font("Helvetica-Bold").fontSize(8.5)
    .text("VOKABELLISTE", left, 42, { characterSpacing: 1.6 });
  document.font("Times-Bold").fontSize(18).text(input.title, left, 64, {
    width: right - left,
    ellipsis: true,
    lineBreak: false,
  });
  const meta = [input.subject, `${input.cards.length} Vokabel${input.cards.length === 1 ? "" : "n"}`]
    .filter(Boolean)
    .join(" · ");
  document.fillColor("#4b4b4b").font("Helvetica").fontSize(8.5)
    .text(pageIndex === 0 ? meta : "Fortsetzung", left, 92, { lineBreak: false });

  document.fillColor("#f0f0f0").rect(left, 119, right - left, 32).fill();
  document.fillColor("#111111").font("Helvetica-Bold").fontSize(8)
    .text(input.leftLabel.toUpperCase(), left + 38, 130, { width: 205, ellipsis: true, lineBreak: false })
    .text(input.rightLabel.toUpperCase(), left + 281, 130, { width: 220, ellipsis: true, lineBreak: false });
  document.moveTo(left + 267, 119).lineTo(left + 267, 151).strokeColor("#b7b7b7").lineWidth(0.45).stroke();
}

function measureListRows(document, cards) {
  document.font("Times-Roman").fontSize(10.5);
  return cards.map((card, index) => ({
    ...card,
    number: index + 1,
    height: Math.max(
      27,
      document.heightOfString(card.prompt, { width: 205, lineGap: 1 }) + 12,
      document.heightOfString(card.answer, { width: 220, lineGap: 1 }) + 12,
    ),
  }));
}

function drawListRow(document, row, y) {
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  document.fillColor("#555555").font("Helvetica").fontSize(8)
    .text(`${row.number}.`, left + 7, y + 9, { width: 22, align: "right", lineBreak: false });
  document.fillColor("#111111").font("Times-Roman").fontSize(10.5)
    .text(row.prompt, left + 38, y + 7, {
      width: 205,
      height: Math.max(12, row.height - 10),
      lineGap: 1,
      ellipsis: true,
    })
    .text(row.answer, left + 281, y + 7, {
      width: 220,
      height: Math.max(12, row.height - 10),
      lineGap: 1,
      ellipsis: true,
    });
  document.moveTo(left + 267, y).lineTo(left + 267, y + row.height)
    .strokeColor("#d0d0d0").lineWidth(0.35).stroke();
  document.moveTo(left, y + row.height).lineTo(right, y + row.height)
    .strokeColor("#c5c5c5").lineWidth(0.4).stroke();
}

function paginateRows(rows, startY, endY) {
  const pages = [];
  let currentPage = [];
  let y = startY;

  for (const row of rows) {
    const safeHeight = Math.min(row.height, endY - startY);
    const printableRow = safeHeight === row.height ? row : { ...row, height: safeHeight };
    if (currentPage.length > 0 && y + printableRow.height > endY) {
      pages.push(currentPage);
      currentPage = [];
      y = startY;
    }
    currentPage.push(printableRow);
    y += printableRow.height;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  return pages.length > 0 ? pages : [[]];
}

function addA4Page(document) {
  document.addPage({
    size: "A4",
    margins: {
      top: PAGE.margin,
      right: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
    },
  });
}

function addPageNumbers(document) {
  const range = document.bufferedPageRange();
  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    document.switchToPage(range.start + pageIndex);
    document.fillColor("#696969").font("Helvetica").fontSize(7.5)
      .text(`Seite ${pageIndex + 1} / ${range.count}`, PAGE.margin, 790, {
        width: PAGE.width - (2 * PAGE.margin),
        align: "right",
        lineBreak: false,
      });
  }
}

function cleanText(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function languageLabel(code, fallback) {
  const labels = {
    de: "Deutsch",
    en: "Englisch",
    fr: "Französisch",
    es: "Spanisch",
    it: "Italienisch",
    la: "Latein",
  };
  return labels[String(code || "").trim().toLowerCase()] || fallback;
}

function buildPrintFilename(setTitle, kind) {
  const slug = cleanText(setTitle, 80)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lernset";
  return `${kind === "test" ? "vokabeltest" : "vokabelliste"}-${slug}.pdf`;
}

module.exports = {
  PrintRequestError,
  buildPrintFilename,
  createVocabularyPrintPdf,
};
