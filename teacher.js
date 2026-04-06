const SET_INDEX_API_PATH = "/api/sets";
const STUDENT_PAGE_NAME = "index.html";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const TEACHER_SESSION_STORAGE_KEY = "dino-vocab-teacher-session-v1";

const state = {
  sets: [],
  tablets: [],
  activeTab: "sets",
  publicOrigin: "",
  activeSet: null,
  activeShareUrl: "",
  activeQrDataUrl: "",
  feedbackTimeoutId: null,
  authReady: false,
};

const elements = {
  authPanel: document.getElementById("teacher-auth-panel"),
  authForm: document.getElementById("teacher-auth-form"),
  authPinInput: document.getElementById("teacher-pin-input"),
  authFeedback: document.getElementById("teacher-auth-feedback"),
  shell: document.getElementById("teacher-shell"),
  logoutButton: document.getElementById("teacher-logout-button"),
  setsMeta: document.getElementById("sets-meta"),
  setList: document.getElementById("teacher-set-list"),
  tabletsMeta: document.getElementById("tablets-meta"),
  tabletList: document.getElementById("teacher-tablet-list"),
  tabletEmptyState: document.getElementById("teacher-tablet-empty-state"),
  tabButtons: document.querySelectorAll("[data-teacher-tab]"),
  tabPanels: document.querySelectorAll("[data-teacher-panel]"),
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
  elements.authForm.addEventListener("submit", handleTeacherAuthSubmit);
  elements.logoutButton.addEventListener("click", handleTeacherLogout);
  elements.copyLinkButton.addEventListener("click", handleCopyLink);
  elements.printShareButton.addEventListener("click", handlePrintShare);
  elements.shareCloseButton.addEventListener("click", closeShareOverlay);

  for (const trigger of elements.closeShareTriggers) {
    trigger.addEventListener("click", closeShareOverlay);
  }

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      setActiveTeacherTab(button.dataset.teacherTab || "sets");
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.shareOverlay.hidden) {
      closeShareOverlay();
    }
  });
}

async function initializeTeacherApp() {
  state.publicOrigin = await loadTeacherShareOrigin();
  setActiveTeacherTab(state.activeTab);

  if (!loadTeacherSessionToken()) {
    showTeacherAuth();
    return;
  }

  await loadProtectedTeacherData();
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
  const response = await requestJson(SET_INDEX_API_PATH, {
    auth: "teacher",
  });

  if (!response.ok) {
    throw createTeacherRequestError(response, "Set-Liste konnte nicht geladen werden.");
  }

  const rawSets = Array.isArray(response.data?.sets) ? response.data.sets : [];

  return rawSets
    .map(normalizeSetEntry)
    .filter(Boolean);
}

async function loadTabletDirectory() {
  const response = await requestJson("/api/tablets", {
    auth: "teacher",
    headers: {
      "Cache-Control": "no-store",
    },
  });

  if (!response.ok) {
    throw createTeacherRequestError(response, "Tablet-Verzeichnis konnte nicht geladen werden.");
  }

  return Array.isArray(response.data?.tablets)
    ? response.data.tablets
        .map((tablet) => normalizeDirectoryTabletEntry(tablet))
        .filter(Boolean)
    : [];
}

async function reloadTeacherData() {
  const [sets, tablets] = await Promise.all([
    loadSetIndex(),
    loadTabletDirectory(),
  ]);

  state.sets = sets;
  state.tablets = tablets;
  renderSetList();
  renderTabletList();
}

async function loadProtectedTeacherData() {
  try {
    await reloadTeacherData();
    showTeacherShell();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to initialize teacher page:", error);
    showTeacherShell();
    renderErrorState(typeof error?.message === "string" ? error.message : "Sets konnten nicht geladen werden.");
  }
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
    title: title || id || "Set",
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
    failedPinAttempts: Number.isFinite(entry?.failedPinAttempts) ? Math.max(0, Math.trunc(entry.failedPinAttempts)) : 0,
    lockedAt: typeof entry?.lockedAt === "string" ? entry.lockedAt.trim() : "",
    isLocked: Boolean(entry?.isLocked),
  };
}

function normalizeDirectoryTabletEntry(entry) {
  const id = typeof entry?.id === "string" ? entry.id.trim() : "";
  const label = typeof entry?.label === "string" ? entry.label.trim() : "";

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    registered: Boolean(entry?.registered),
    isCoupled: Boolean(entry?.isCoupled),
    failedPinAttempts: Number.isFinite(entry?.failedPinAttempts) ? Math.max(0, Math.trunc(entry.failedPinAttempts)) : 0,
    lockedAt: typeof entry?.lockedAt === "string" ? entry.lockedAt.trim() : "",
    isLocked: Boolean(entry?.isLocked),
    subscriptions: Array.isArray(entry?.subscriptions) ? entry.subscriptions : [],
    updatedAt: typeof entry?.updatedAt === "string" ? entry.updatedAt.trim() : "",
    lastSeenAt: typeof entry?.lastSeenAt === "string" ? entry.lastSeenAt.trim() : "",
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

function setActiveTeacherTab(nextTab) {
  state.activeTab = nextTab === "tablets" ? "tablets" : "sets";

  for (const button of elements.tabButtons) {
    const isActive = button.dataset.teacherTab === state.activeTab;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const panel of elements.tabPanels) {
    panel.hidden = panel.dataset.teacherPanel !== state.activeTab;
  }
}

function renderTabletList() {
  elements.tabletList.replaceChildren();

  if (state.tablets.length === 0) {
    elements.tabletEmptyState.hidden = false;
    elements.tabletsMeta.textContent = "0 Geräte";
    return;
  }

  elements.tabletEmptyState.hidden = true;
  elements.tabletsMeta.textContent = `${state.tablets.length} Gerät${state.tablets.length === 1 ? "" : "e"}`;

  for (const tablet of state.tablets) {
    elements.tabletList.append(createTabletDirectoryRow(tablet));
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
  meta.textContent = setEntry.description || (setEntry.id === setEntry.path ? "Set" : setEntry.id);

  copy.append(title, meta, createTabletAssignmentBlock(setEntry));

  const action = document.createElement("button");
  action.className = "teacher-button";
  action.type = "button";
  action.textContent = "Teilen";
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
    empty.textContent = "Nicht abonniert";
    wrapper.append(empty);
    return wrapper;
  }

  for (const tablet of setEntry.tablets) {
    const row = document.createElement("div");
    row.className = "teacher-set-row__tablet";

    const tabletInfo = document.createElement("div");
    tabletInfo.className = "teacher-set-row__tablet-info";
    tabletInfo.append(createDevicePill(tablet), createTabletStatusBadge(tablet));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "teacher-tablet-remove";
    removeButton.textContent = "Abo beenden";
    removeButton.addEventListener("click", () => {
      void handleRemoveTabletSubscription(tablet.id, setEntry.path);
    });

    row.append(tabletInfo, removeButton);
    wrapper.append(row);
  }

  return wrapper;
}

function createDevicePill(tablet) {
  const pill = document.createElement("span");
  pill.className = "device-pill";
  pill.dataset.tabletGroup = getTabletGroupName(tablet.label || tablet.id);
  if (tablet.isLocked) {
    pill.classList.add("device-pill--locked");
  }

  const icon = document.createElement("img");
  icon.className = "device-pill__icon";
  icon.src = TABLET_ICON_PATH;
  icon.alt = "";
  icon.decoding = "async";

  const label = document.createElement("span");
  label.className = "device-pill__label";
  label.textContent = tablet.label || tablet.id;

  pill.append(icon, label);
  return pill;
}

function createTabletStatusBadge(tablet) {
  const status = document.createElement("span");
  status.className = "teacher-status-badge";

  if (tablet.isLocked) {
    status.classList.add("teacher-status-badge--locked");
    status.append(createStatusIcon("lock"), document.createTextNode("Gesperrt"));
    return status;
  }

  if (tablet.failedPinAttempts > 0) {
    status.classList.add("teacher-status-badge--warning");
    status.textContent = `${tablet.failedPinAttempts}/${3} Fehlversuche`;
    return status;
  }

  status.textContent = tablet.registered ? "Gekoppelt" : "Frei";
  return status;
}

function createTabletDirectoryRow(tablet) {
  const row = document.createElement("article");
  row.className = "teacher-tablet-row";

  const copy = document.createElement("div");
  copy.className = "teacher-tablet-row__copy";

  const header = document.createElement("div");
  header.className = "teacher-tablet-row__header";
  header.append(createDevicePill(tablet), createTabletStatusBadge(tablet));

  const meta = document.createElement("p");
  meta.className = "teacher-tablet-row__meta";
  meta.textContent = getTabletDirectoryMetaText(tablet);

  copy.append(header, meta);

  const actions = document.createElement("div");
  actions.className = "teacher-tablet-row__actions";

  const unlockAction = document.createElement("button");
  unlockAction.type = "button";
  unlockAction.className = "teacher-button teacher-button--secondary";
  unlockAction.textContent = "Sperre aufheben";
  unlockAction.disabled = !tablet.isLocked;
  unlockAction.addEventListener("click", () => {
    void handleResetTabletLock(tablet.id);
  });

  const decoupleAction = document.createElement("button");
  decoupleAction.type = "button";
  decoupleAction.className = "teacher-button teacher-button--danger";
  decoupleAction.textContent = "Kopplung löschen";
  decoupleAction.disabled = !tablet.registered;
  decoupleAction.addEventListener("click", () => {
    void handleDecoupleTablet(tablet);
  });

  actions.append(unlockAction, decoupleAction);

  row.append(copy, actions);
  return row;
}

function getTabletDirectoryMetaText(tablet) {
  if (tablet.isLocked) {
    return "Nach 3 falschen PIN-Eingaben gesperrt.";
  }

  if (tablet.failedPinAttempts > 0) {
    return `${tablet.failedPinAttempts} von 3 Fehlversuchen erreicht.`;
  }

  if (!tablet.registered) {
    return "Frei. Kann neu gekoppelt werden.";
  }

  const subscriptionCount = Array.isArray(tablet.subscriptions) ? tablet.subscriptions.length : 0;
  return `${subscriptionCount} Lernset${subscriptionCount === 1 ? "" : "s"} aktiv. Kopplung löschen entfernt PIN, Lernsets und Lernstände für die nächste Registrierung.`;
}

function getTabletGroupName(value) {
  return value
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderErrorState(message) {
  elements.setList.replaceChildren();
  elements.tabletList.replaceChildren();
  elements.emptyState.hidden = true;
  elements.tabletEmptyState.hidden = true;
  elements.errorState.hidden = false;
  elements.errorMessage.textContent = message;
  elements.setsMeta.textContent = "Fehler";
  elements.tabletsMeta.textContent = "";
}

function loadTeacherSessionToken() {
  const value = window.sessionStorage.getItem(TEACHER_SESSION_STORAGE_KEY);
  return typeof value === "string" ? value.trim() : "";
}

function persistTeacherSessionToken(token) {
  if (!token) {
    clearTeacherSessionToken();
    return;
  }

  window.sessionStorage.setItem(TEACHER_SESSION_STORAGE_KEY, token);
}

function clearTeacherSessionToken() {
  window.sessionStorage.removeItem(TEACHER_SESSION_STORAGE_KEY);
}

function createTeacherRequestError(response, fallbackMessage) {
  const error = new Error(response.data?.error || fallbackMessage);
  error.requiresAuth = response.status === 401 || response.status === 403;
  return error;
}

function showTeacherAuth(feedback = "") {
  clearTeacherSessionToken();
  closeShareOverlay();
  state.authReady = false;
  elements.authPanel.hidden = false;
  elements.shell.hidden = true;
  elements.authFeedback.textContent = feedback;
  elements.authPinInput.value = "";
  requestAnimationFrame(() => {
    elements.authPinInput.focus();
  });
}

function showTeacherShell() {
  state.authReady = true;
  elements.authPanel.hidden = true;
  elements.shell.hidden = false;
  elements.authFeedback.textContent = "";
}

function createStatusIcon(kind) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("teacher-status-badge__icon");

  if (kind === "lock") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 1 0-6 0v2z");
    icon.append(path);
  }

  return icon;
}

async function openShareOverlay(setEntry) {
  state.activeSet = setEntry;
  state.activeShareUrl = buildStudentShareUrl(setEntry.path);
  elements.shareTitle.textContent = setEntry.title;
  elements.sharePath.textContent = "";
  elements.sharePath.hidden = true;
  elements.shareLink.value = state.activeShareUrl;
  elements.shareFeedback.textContent = "";
  elements.shareOverlay.hidden = false;

  try {
    await renderShareQr(state.activeShareUrl);
  } catch (error) {
    console.error("Unable to render QR code:", error);
    state.activeQrDataUrl = "";
    elements.shareFeedback.textContent = "QR-Code fehlt.";
    clearQrCanvas();
  }
}

function closeShareOverlay() {
  elements.shareOverlay.hidden = true;
  elements.sharePath.hidden = true;
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
  if (window.QRious) {
    elements.shareQrCanvas.width = canvasSize;
    elements.shareQrCanvas.height = canvasSize;

    new window.QRious({
      element: elements.shareQrCanvas,
      value: shareUrl,
      size: canvasSize,
      level: "M",
      background: "#ffffff",
      foreground: "#111111",
      padding: 0,
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
      {
        method: "DELETE",
        auth: "teacher",
      },
    );

    if (!response.ok) {
      throw createTeacherRequestError(response, "Abo konnte nicht beendet werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to remove set assignment:", error);
    renderErrorState(typeof error?.message === "string" ? error.message : "Abo konnte nicht beendet werden.");
  }
}

async function handleResetTabletLock(tabletId) {
  try {
    const response = await requestJson(`/api/tablets/${encodeURIComponent(tabletId)}/reset-lock`, {
      auth: "teacher",
      method: "POST",
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "Sperre konnte nicht aufgehoben werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to reset tablet lock:", error);
    renderErrorState(typeof error?.message === "string" ? error.message : "Sperre konnte nicht aufgehoben werden.");
  }
}

async function handleDecoupleTablet(tablet) {
  const label = tablet.label || tablet.id;
  const confirmed = window.confirm(
    `${label} wirklich entkoppeln?\n\nDabei werden PIN, Lernsets und die Zuordnung gelöscht. Bei einer neuen Registrierung startet das Tablet wieder leer.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await requestJson(`/api/tablets/${encodeURIComponent(tablet.id)}/decouple`, {
      auth: "teacher",
      method: "POST",
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "Kopplung konnte nicht gelöscht werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to decouple tablet:", error);
    renderErrorState(typeof error?.message === "string" ? error.message : "Kopplung konnte nicht gelöscht werden.");
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

    setFeedback("Kopiert.");
  } catch (error) {
    console.error("Unable to copy link:", error);
    setFeedback("Kopieren fehlgeschlagen.");
  }
}

async function handleTeacherAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const pin = typeof formData.get("teacher-pin") === "string"
    ? formData.get("teacher-pin").trim()
    : "";

  if (!pin) {
    elements.authFeedback.textContent = "Bitte PIN eingeben.";
    return;
  }

  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await requestJson("/api/teacher/session", {
      method: "POST",
      body: { pin },
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "Lehrerbereich konnte nicht entsperrt werden.");
    }

    persistTeacherSessionToken(response.data?.session?.token || "");
    await loadProtectedTeacherData();
  } catch (error) {
    console.error("Unable to unlock teacher page:", error);
    showTeacherAuth(typeof error?.message === "string" ? error.message : "Lehrerbereich konnte nicht entsperrt werden.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleTeacherLogout() {
  try {
    await requestJson("/api/teacher/session", {
      method: "DELETE",
      auth: "teacher",
    });
  } catch (error) {
    console.error("Unable to close teacher session:", error);
  }

  showTeacherAuth();
}

async function requestJson(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.auth === "teacher") {
    const token = loadTeacherSessionToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
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
    setFeedback("Drucken fehlgeschlagen.");
    return;
  }

  const qrMarkup = state.activeQrDataUrl
    ? `<img src="${escapeHtml(state.activeQrDataUrl)}" alt="QR-Code für ${escapeHtml(state.activeSet.title)}" style="width: 360px; height: 360px;" />`
    : `<p>QR-Code nicht verfügbar</p>`;

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
