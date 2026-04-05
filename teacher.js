const SET_INDEX_API_PATH = "/api/sets";
const SET_INDEX_FALLBACK_PATH = "./sets/sets-index.json";
const STUDENT_PAGE_NAME = "index.html";

const state = {
  sets: [],
  publicOrigin: "",
  activeSet: null,
  activeShareUrl: "",
  activeQrDataUrl: "",
  feedbackTimeoutId: null,
};

const elements = {
  setsMeta: document.getElementById("sets-meta"),
  setList: document.getElementById("teacher-set-list"),
  emptyState: document.getElementById("teacher-empty-state"),
  errorState: document.getElementById("teacher-error-state"),
  errorMessage: document.getElementById("teacher-error-message"),
  shareOverlay: document.getElementById("share-overlay"),
  shareTitle: document.getElementById("share-title"),
  sharePath: document.getElementById("share-path"),
  shareLink: document.getElementById("share-link"),
  shareQrCanvas: document.getElementById("share-qr-canvas"),
  copyLinkButton: document.getElementById("copy-link-button"),
  printShareButton: document.getElementById("print-share-button"),
  shareFeedback: document.getElementById("share-feedback"),
  shareCloseButton: document.getElementById("share-close-button"),
  closeShareTriggers: document.querySelectorAll("[data-close-share]"),
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initializeTeacherApp();
});

function bindEvents() {
  elements.copyLinkButton.addEventListener("click", handleCopyLink);
  elements.printShareButton.addEventListener("click", handlePrintShare);
  elements.shareCloseButton.addEventListener("click", closeShareOverlay);

  for (const trigger of elements.closeShareTriggers) {
    trigger.addEventListener("click", closeShareOverlay);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.shareOverlay.hidden) {
      closeShareOverlay();
    }
  });
}

async function initializeTeacherApp() {
  try {
    state.publicOrigin = await loadTeacherShareOrigin();
    const sets = await loadSetIndex();
    state.sets = sets;
    renderSetList();
  } catch (error) {
    console.error("Unable to initialize teacher page:", error);
    renderErrorState("Die statische Set-Liste konnte nicht geladen werden.");
  }
}

async function loadTeacherShareOrigin() {
  try {
    const data = await fetchSetIndex("/api/runtime-info");
    const publicOrigin = typeof data?.publicOrigin === "string" ? data.publicOrigin.trim() : "";
    return publicOrigin || window.location.origin;
  } catch (error) {
    return window.location.origin;
  }
}

async function loadSetIndex() {
  let data;

  try {
    data = await fetchSetIndex(SET_INDEX_API_PATH);
  } catch (error) {
    data = await fetchSetIndex(SET_INDEX_FALLBACK_PATH);
  }

  const rawSets = Array.isArray(data?.sets) ? data.sets : [];

  return rawSets
    .map(normalizeSetEntry)
    .filter(Boolean);
}

async function fetchSetIndex(path) {
  const response = await fetch(path, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function normalizeSetEntry(entry) {
  const path = typeof entry?.path === "string" ? entry.path.trim() : "";
  const title = typeof entry?.title === "string" ? entry.title.trim() : "";
  const id = typeof entry?.id === "string" ? entry.id.trim() : "";
  const description = typeof entry?.description === "string" ? entry.description.trim() : "";
  const tablets = Array.isArray(entry?.tablets)
    ? entry.tablets
        .map((tablet) => normalizeTabletEntry(tablet))
        .filter(Boolean)
    : [];

  if (!isValidSetPath(path)) {
    return null;
  }

  return {
    id: id || path,
    path,
    title: title || id || path,
    description,
    tablets,
  };
}

function normalizeTabletEntry(entry) {
  const id = typeof entry?.id === "string" ? entry.id.trim() : "";
  const label = typeof entry?.label === "string" ? entry.label.trim() : "";

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    subscribedAt: typeof entry?.subscribedAt === "string" ? entry.subscribedAt.trim() : "",
  };
}

function isValidSetPath(path) {
  if (
    !path ||
    !path.endsWith(".json") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    !path.startsWith("sets/")
  ) {
    return false;
  }

  const parts = path.split("/");
  return !parts.some((segment) => segment === "" || segment === "." || segment === "..");
}

function renderSetList() {
  elements.setList.replaceChildren();
  elements.errorState.hidden = true;

  if (state.sets.length === 0) {
    elements.emptyState.hidden = false;
    elements.setsMeta.textContent = "0 Sets";
    return;
  }

  elements.emptyState.hidden = true;
  elements.setsMeta.textContent = `${state.sets.length} Set${state.sets.length === 1 ? "" : "s"}`;

  for (const setEntry of state.sets) {
    elements.setList.append(createSetRow(setEntry));
  }
}

function createSetRow(setEntry) {
  const row = document.createElement("article");
  row.className = "teacher-set-row";
  row.setAttribute("role", "listitem");

  const copy = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "teacher-set-row__title";
  title.textContent = setEntry.title;

  const meta = document.createElement("p");
  meta.className = "teacher-set-row__meta";
  meta.textContent = [
    setEntry.description || setEntry.id,
    `${setEntry.tablets.length} iPad${setEntry.tablets.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  const path = document.createElement("span");
  path.className = "teacher-set-row__path";
  path.textContent = setEntry.path;

  copy.append(title, meta, path, createTabletAssignmentBlock(setEntry));

  const action = document.createElement("button");
  action.className = "teacher-button";
  action.type = "button";
  action.textContent = "Share";
  action.addEventListener("click", () => {
    openShareOverlay(setEntry);
  });

  row.append(copy, action);
  return row;
}

function createTabletAssignmentBlock(setEntry) {
  const wrapper = document.createElement("div");
  wrapper.className = "teacher-set-row__tablets";

  if (setEntry.tablets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "teacher-set-row__tablet-empty";
    empty.textContent = "Noch kein iPad zugeordnet.";
    wrapper.append(empty);
    return wrapper;
  }

  for (const tablet of setEntry.tablets) {
    const row = document.createElement("div");
    row.className = "teacher-set-row__tablet";

    const label = document.createElement("span");
    label.className = "teacher-set-row__tablet-label";
    label.textContent = tablet.label;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "teacher-tablet-remove";
    removeButton.textContent = "Abo loeschen";
    removeButton.addEventListener("click", () => {
      void handleRemoveTabletSubscription(tablet.id, setEntry.path);
    });

    row.append(label, removeButton);
    wrapper.append(row);
  }

  return wrapper;
}

function renderErrorState(message) {
  elements.setList.replaceChildren();
  elements.emptyState.hidden = true;
  elements.errorState.hidden = false;
  elements.errorMessage.textContent = message;
  elements.setsMeta.textContent = "Fehler";
}

async function openShareOverlay(setEntry) {
  state.activeSet = setEntry;
  state.activeShareUrl = buildStudentShareUrl(setEntry.path);
  elements.shareTitle.textContent = setEntry.title;
  elements.sharePath.textContent = setEntry.path;
  elements.shareLink.value = state.activeShareUrl;
  elements.shareFeedback.textContent = "";
  elements.shareOverlay.hidden = false;

  try {
    await renderShareQr(state.activeShareUrl);
  } catch (error) {
    console.error("Unable to render QR code:", error);
    state.activeQrDataUrl = "";
    elements.shareFeedback.textContent = "QR-Code konnte nicht erstellt werden.";
    clearQrCanvas();
  }
}

function closeShareOverlay() {
  elements.shareOverlay.hidden = true;
  elements.shareFeedback.textContent = "";
}

function buildStudentShareUrl(setPath) {
  const url = new URL(STUDENT_PAGE_NAME, `${state.publicOrigin || window.location.origin}/`);
  url.searchParams.set("set", setPath);
  return url.href;
}

async function renderShareQr(shareUrl) {
  clearQrCanvas();
  const canvasSize = Math.min(
    elements.shareQrCanvas.width,
    elements.shareQrCanvas.height,
  );
  const qrPadding = Math.round(canvasSize * 0.06);

  if (window.QRious) {
    new window.QRious({
      element: elements.shareQrCanvas,
      value: shareUrl,
      size: canvasSize,
      level: "M",
      background: "#ffffff",
      foreground: "#111111",
      padding: qrPadding,
    });

    state.activeQrDataUrl = elements.shareQrCanvas.toDataURL("image/png");
    return;
  }

  if (window.QRCode && typeof window.QRCode.toCanvas === "function") {
    await window.QRCode.toCanvas(elements.shareQrCanvas, shareUrl, {
      width: canvasSize,
      margin: 2,
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
    });

    if (typeof window.QRCode.toDataURL === "function") {
      state.activeQrDataUrl = await window.QRCode.toDataURL(shareUrl, {
        width: 720,
        margin: 1,
        color: {
          dark: "#111111",
          light: "#ffffff",
        },
      });
      return;
    }

    state.activeQrDataUrl = elements.shareQrCanvas.toDataURL("image/png");
    return;
  }

  throw new Error("QRCode library is unavailable.");
}

function clearQrCanvas() {
  const context = elements.shareQrCanvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, elements.shareQrCanvas.width, elements.shareQrCanvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, elements.shareQrCanvas.width, elements.shareQrCanvas.height);
}

async function handleRemoveTabletSubscription(tabletId, setPath) {
  try {
    const response = await requestJson(
      `/api/tablets/${encodeURIComponent(tabletId)}/subscriptions?set=${encodeURIComponent(setPath)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw new Error(response.data?.error || "Abo konnte nicht entfernt werden.");
    }

    const sets = await loadSetIndex();
    state.sets = sets;
    renderSetList();
  } catch (error) {
    console.error("Unable to remove set assignment:", error);
    renderErrorState(typeof error?.message === "string" ? error.message : "Abo konnte nicht entfernt werden.");
  }
}

async function handleCopyLink() {
  if (!state.activeShareUrl) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(state.activeShareUrl);
    } else {
      elements.shareLink.select();
      document.execCommand("copy");
    }

    setFeedback("Link kopiert.");
  } catch (error) {
    console.error("Unable to copy link:", error);
    setFeedback("Link konnte nicht kopiert werden.");
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function handlePrintShare() {
  if (!state.activeSet || !state.activeShareUrl) {
    return;
  }

  const printWindow = window.open("", "_blank", "width=900,height=980");

  if (!printWindow) {
    setFeedback("Druckfenster konnte nicht geoeffnet werden.");
    return;
  }

  const qrMarkup = state.activeQrDataUrl
    ? `<img src="${escapeHtml(state.activeQrDataUrl)}" alt="QR-Code fuer ${escapeHtml(state.activeSet.title)}" style="width: 360px; height: 360px;" />`
    : `<p>QR-Code nicht verfuegbar</p>`;

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(state.activeSet.title)} drucken</title>
        <style>
          body {
            margin: 0;
            padding: 40px;
            font-family: sans-serif;
            color: #111111;
          }
          .sheet {
            display: grid;
            gap: 24px;
            justify-items: start;
          }
          h1 {
            margin: 0;
            font-size: 36px;
            line-height: 1;
          }
          p {
            margin: 0;
            font-size: 16px;
            line-height: 1.45;
            word-break: break-word;
          }
          .qr {
            padding: 20px;
            border: 1px solid #cccccc;
          }
          .path {
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <p class="path">${escapeHtml(state.activeSet.path)}</p>
          <h1>${escapeHtml(state.activeSet.title)}</h1>
          <div class="qr">${qrMarkup}</div>
          <p>${escapeHtml(state.activeShareUrl)}</p>
        </main>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function setFeedback(message) {
  elements.shareFeedback.textContent = message;

  if (state.feedbackTimeoutId !== null) {
    window.clearTimeout(state.feedbackTimeoutId);
  }

  state.feedbackTimeoutId = window.setTimeout(() => {
    elements.shareFeedback.textContent = "";
    state.feedbackTimeoutId = null;
  }, 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
