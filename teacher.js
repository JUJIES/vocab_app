const SET_INDEX_API_PATH = "/api/sets";
const STUDENT_PAGE_NAME = "index.html";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const STATUS_CONNECTED_ICON_PATH = "./assets/icons/status-connected.svg";
const STATUS_DISCONNECTED_ICON_PATH = "./assets/icons/status-disconnected.svg";
const EXTERNAL_LINK_ICON_PATH = "./assets/icons/external-link.svg";
const BROKEN_LINK_ICON_PATH = "./assets/icons/broken-link.svg";
const TIMEOUT_ICON_PATH = "./assets/icons/timeout.svg";
const PASSWORD_ICON_PATH = "./assets/icons/password-svgrepo-com.svg";
const TEACHER_SESSION_STORAGE_KEY = "dino-vocab-teacher-session-v1";

const state = {
  sets: [],
  tablets: [],
  activeTab: "sets",
  setPanels: {},
  publicOrigin: "",
  activeSet: null,
  activeShareUrl: "",
  activeQrDataUrl: "",
  feedbackTimeoutId: null,
  authReady: false,
};

const TEACHER_TAB_COPY = {
  sets: {
    title: "Lernsets",
    message: "Lernsets verwalten, teilen und Tablet-Zuweisungen gezielt entfernen.",
  },
  tablets: {
    title: "Tablets",
    message: "Geräte prüfen, aktive Login-Timeouts sehen und Kopplungen bewusst zurücksetzen.",
  },
};

const elements = {
  authPanel: document.getElementById("teacher-auth-panel"),
  authForm: document.getElementById("teacher-auth-form"),
  authPinInput: document.getElementById("teacher-pin-input"),
  authFeedback: document.getElementById("teacher-auth-feedback"),
  shell: document.getElementById("teacher-shell"),
  shellTitle: document.getElementById("teacher-shell-title"),
  shellMessage: document.getElementById("teacher-shell-message"),
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
    if (event.key === "Escape") {
      if (!elements.shareOverlay.hidden) {
        closeShareOverlay();
        return;
      }

      closeTabletActionMenus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-tablet-menu]")) {
      closeTabletActionMenus();
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
    subscriptions: Array.isArray(entry?.subscriptions) ? entry.subscriptions : [],
    accessSession: normalizeAccessSession(entry?.accessSession),
    updatedAt: typeof entry?.updatedAt === "string" ? entry.updatedAt.trim() : "",
    lastSeenAt: typeof entry?.lastSeenAt === "string" ? entry.lastSeenAt.trim() : "",
  };
}

function normalizeAccessSession(entry) {
  const tabletId = typeof entry?.tabletId === "string" ? entry.tabletId.trim() : "";
  const failureCount = Number.isFinite(entry?.failureCount) ? Math.max(0, Math.trunc(entry.failureCount)) : 0;
  const remainingMs = Number.isFinite(entry?.remainingMs) ? Math.max(0, Math.ceil(entry.remainingMs)) : 0;

  return {
    tabletId,
    failureCount,
    isBound: Boolean(entry?.isBound && tabletId),
    isCoolingDown: Boolean(entry?.isCoolingDown && remainingMs > 0),
    remainingMs,
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
  updateTeacherShellCopy();

  for (const button of elements.tabButtons) {
    const isActive = button.dataset.teacherTab === state.activeTab;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  }

  for (const panel of elements.tabPanels) {
    const isActive = panel.dataset.teacherPanel === state.activeTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  }
}

function updateTeacherShellCopy() {
  const copy = TEACHER_TAB_COPY[state.activeTab] || TEACHER_TAB_COPY.sets;
  elements.shellTitle.textContent = copy.title;
  elements.shellMessage.textContent = copy.message;
}

function renderTabletList() {
  elements.tabletList.replaceChildren();
  closeTabletActionMenus();

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
  copy.className = "teacher-set-row__copy";

  const title = document.createElement("h3");
  title.className = "teacher-set-row__title";
  title.textContent = setEntry.title;

  const meta = document.createElement("p");
  meta.className = "teacher-set-row__meta";
  meta.textContent = setEntry.description || (setEntry.id === setEntry.path ? "Set" : setEntry.id);

  copy.append(title, meta, createTabletAssignmentBlock(setEntry));

  const action = document.createElement("button");
  action.className = "teacher-set-row__share";
  action.type = "button";
  action.setAttribute("aria-label", `Set ${setEntry.title} teilen`);
  action.title = "Teilen";
  action.append(
    createButtonIcon(EXTERNAL_LINK_ICON_PATH),
  );
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
    empty.textContent = "Nicht zugewiesen";
    wrapper.append(empty);
    return wrapper;
  }

  const isExpanded = isSetTabletListExpanded(setEntry);
  wrapper.dataset.expanded = isExpanded ? "true" : "false";

  const panelId = `teacher-set-panel-${createDomSafeToken(setEntry.path)}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "teacher-set-row__toggle";
  toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  toggle.setAttribute("aria-controls", panelId);

  const toggleLabel = document.createElement("span");
  toggleLabel.className = "teacher-set-row__toggle-label";
  toggleLabel.textContent = `${setEntry.tablets.length} Tablet${setEntry.tablets.length === 1 ? "" : "s"}`;

  const toggleMeta = document.createElement("span");
  toggleMeta.className = "teacher-set-row__toggle-meta";
  toggleMeta.textContent = "zugewiesen";

  const toggleChevron = document.createElement("span");
  toggleChevron.className = "teacher-set-row__toggle-chevron";
  toggleChevron.setAttribute("aria-hidden", "true");
  toggleChevron.textContent = "⌄";

  toggle.append(toggleLabel, toggleMeta, toggleChevron);

  const panel = document.createElement("div");
  panel.className = "teacher-set-row__tablets-panel";
  panel.id = panelId;
  panel.setAttribute("aria-hidden", isExpanded ? "false" : "true");

  const panelInner = document.createElement("div");
  panelInner.className = "teacher-set-row__tablets-panel-inner";

  for (const tablet of setEntry.tablets) {
    const row = document.createElement("div");
    row.className = "teacher-set-row__tablet";

    const tabletInfo = document.createElement("div");
    tabletInfo.className = "teacher-set-row__tablet-info";
    tabletInfo.append(createDevicePill(tablet));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "teacher-tablet-remove";
    removeButton.textContent = "Zuweisung entfernen";
    removeButton.addEventListener("click", () => {
      void handleRemoveTabletSubscription(tablet.id, setEntry.path);
    });

    row.append(tabletInfo, removeButton);
    panelInner.append(row);
  }

  panel.append(panelInner);
  toggle.addEventListener("click", () => {
    const nextExpanded = wrapper.dataset.expanded !== "true";
    setSetTabletListExpanded(setEntry.path, nextExpanded);
    wrapper.dataset.expanded = nextExpanded ? "true" : "false";
    toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    panel.setAttribute("aria-hidden", nextExpanded ? "false" : "true");
  });

  wrapper.append(toggle, panel);
  return wrapper;
}

function createDevicePill(tablet) {
  const pill = document.createElement("span");
  pill.className = "teacher-chip device-pill";
  pill.dataset.tabletGroup = getTabletGroupName(tablet.label || tablet.id);

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
  status.className = "teacher-chip teacher-status-badge";

  if (tablet.accessSession?.isCoolingDown) {
    status.classList.add("teacher-status-badge--warning");
    status.textContent = `Timeout ${formatDuration(tablet.accessSession.remainingMs)}`;
    return status;
  }

  if (tablet.accessSession?.isBound) {
    status.classList.add("teacher-status-badge--secondary");
    status.textContent = "Login aktiv";
    return status;
  }

  const isRegistered = tablet.registered;
  status.classList.add(isRegistered ? "teacher-status-badge--registered" : "teacher-status-badge--available");
  status.append(
    createBadgeIcon(isRegistered ? STATUS_CONNECTED_ICON_PATH : STATUS_DISCONNECTED_ICON_PATH),
    document.createTextNode(isRegistered ? "Gekoppelt" : "Frei"),
  );
  return status;
}

function createTabletSubscriptionBadge(tablet) {
  const subscriptionCount = Array.isArray(tablet.subscriptions) ? tablet.subscriptions.length : 0;
  const badge = document.createElement("span");
  badge.className = "teacher-chip teacher-status-badge teacher-status-badge--metric";
  badge.textContent = `${subscriptionCount} Lernset${subscriptionCount === 1 ? "" : "s"} aktiv`;
  return badge;
}

function createTabletDirectoryRow(tablet) {
  const row = document.createElement("article");
  row.className = "teacher-tablet-row";

  const copy = document.createElement("div");
  copy.className = "teacher-tablet-row__copy";

  const header = document.createElement("div");
  header.className = "teacher-tablet-row__header";
  header.append(createDevicePill(tablet), createTabletStatusBadge(tablet));
  if (tablet.registered) {
    header.append(createTabletSubscriptionBadge(tablet));
  }

  copy.append(header);
  const metaText = getTabletDirectoryMetaText(tablet);
  if (metaText) {
    const meta = document.createElement("p");
    meta.className = "teacher-tablet-row__meta";
    meta.textContent = metaText;
    copy.append(meta);
  }

  const actions = document.createElement("div");
  actions.className = "teacher-tablet-row__actions";
  actions.dataset.tabletMenu = tablet.id;

  const menuShell = document.createElement("div");
  menuShell.className = "teacher-tablet-row__menu-shell";
  menuShell.dataset.tabletMenu = tablet.id;

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "teacher-tablet-row__menu-button";
  menuButton.setAttribute("aria-label", `Aktionen für ${tablet.label || tablet.id}`);
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.dataset.tabletMenu = tablet.id;
  menuButton.append(createMenuDot(), createMenuDot(), createMenuDot());

  const menu = document.createElement("div");
  menu.className = "teacher-tablet-row__menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.dataset.tabletMenu = tablet.id;

  const resetPinAction = document.createElement("button");
  resetPinAction.type = "button";
  resetPinAction.className = "teacher-tablet-row__menu-action";
  resetPinAction.setAttribute("role", "menuitem");
  resetPinAction.disabled = !tablet.registered;
  resetPinAction.append(
    createButtonIcon(PASSWORD_ICON_PATH),
    document.createTextNode("PIN neu setzen"),
  );
  resetPinAction.addEventListener("click", () => {
    closeTabletActionMenus();
    void handleResetTabletPin(tablet);
  });

  const releaseAction = document.createElement("button");
  releaseAction.type = "button";
  releaseAction.className = "teacher-tablet-row__menu-action";
  releaseAction.setAttribute("role", "menuitem");
  releaseAction.disabled = !tablet.accessSession?.isBound;
  releaseAction.append(
    createButtonIcon(TIMEOUT_ICON_PATH),
    document.createTextNode("Freigabe aufheben"),
  );
  releaseAction.addEventListener("click", () => {
    closeTabletActionMenus();
    void handleResetAccessSession(tablet.id);
  });

  const decoupleAction = document.createElement("button");
  decoupleAction.type = "button";
  decoupleAction.className = "teacher-tablet-row__menu-action teacher-tablet-row__menu-action--danger";
  decoupleAction.setAttribute("role", "menuitem");
  decoupleAction.disabled = !tablet.registered;
  decoupleAction.append(
    createButtonIcon(BROKEN_LINK_ICON_PATH),
    document.createTextNode("Kopplung löschen"),
  );
  decoupleAction.addEventListener("click", () => {
    closeTabletActionMenus();
    void handleDecoupleTablet(tablet);
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTabletActionMenu(menuShell, menuButton, menu);
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  menu.append(resetPinAction, releaseAction, decoupleAction);
  menuShell.append(menuButton, menu);
  actions.append(menuShell);

  row.append(copy, actions);
  return row;
}

function getTabletDirectoryMetaText(tablet) {
  if (tablet.accessSession?.isCoolingDown) {
    return "";
  }

  if (tablet.accessSession?.isBound) {
    return "Login-Versuch ist auf dieses Tablet festgelegt. Ein Gerätewechsel ist erst nach erfolgreichem Login oder einer Freigabe möglich.";
  }

  if (!tablet.registered) {
    return "";
  }

  return "";
}

function getTabletGroupName(value) {
  return value
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isSetTabletListExpanded(setEntry) {
  const savedState = state.setPanels[setEntry.path];
  if (typeof savedState === "boolean") {
    return savedState;
  }

  return setEntry.tablets.length <= 1;
}

function setSetTabletListExpanded(path, expanded) {
  state.setPanels[path] = expanded;
}

function createDomSafeToken(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function createBadgeIcon(path) {
  const icon = document.createElement("img");
  icon.className = "teacher-status-badge__icon";
  icon.src = path;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createButtonIcon(path) {
  const icon = document.createElement("img");
  icon.className = "teacher-button__icon";
  icon.src = path;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
}

function createMenuDot() {
  const dot = document.createElement("span");
  dot.className = "teacher-tablet-row__menu-dot";
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function toggleTabletActionMenu(shell, button, menu) {
  const shouldOpen = menu.hidden;
  closeTabletActionMenus();

  if (!shouldOpen) {
    return;
  }

  shell.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
  menu.hidden = false;
}

function closeTabletActionMenus() {
  const openMenus = document.querySelectorAll(".teacher-tablet-row__menu-shell.is-open");

  for (const shell of openMenus) {
    shell.classList.remove("is-open");

    const button = shell.querySelector(".teacher-tablet-row__menu-button");
    const menu = shell.querySelector(".teacher-tablet-row__menu");

    if (button instanceof HTMLElement) {
      button.setAttribute("aria-expanded", "false");
    }

    if (menu instanceof HTMLElement) {
      menu.hidden = true;
    }
  }
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

function showTeacherActionError(message) {
  window.alert(message);
}

function loadPersistentStorageItem(key) {
  const localValue = window.localStorage.getItem(key);

  if (typeof localValue === "string" && localValue) {
    return localValue;
  }

  const sessionValue = window.sessionStorage.getItem(key);

  if (typeof sessionValue === "string" && sessionValue) {
    window.localStorage.setItem(key, sessionValue);
    return sessionValue;
  }

  return "";
}

function persistPersistentStorageItem(key, value) {
  if (!value) {
    clearPersistentStorageItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
}

function clearPersistentStorageItem(key) {
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

function loadTeacherSessionToken() {
  const value = loadPersistentStorageItem(TEACHER_SESSION_STORAGE_KEY);
  return typeof value === "string" ? value.trim() : "";
}

function persistTeacherSessionToken(token) {
  if (!token) {
    clearTeacherSessionToken();
    return;
  }

  persistPersistentStorageItem(TEACHER_SESSION_STORAGE_KEY, token);
}

function clearTeacherSessionToken() {
  clearPersistentStorageItem(TEACHER_SESSION_STORAGE_KEY);
}

function createTeacherRequestError(response, fallbackMessage) {
  const error = new Error(response.data?.error || fallbackMessage);
  error.requiresAuth = response.status === 401 || response.status === 403;
  return error;
}

function showTeacherAuth(feedback = "") {
  clearTeacherSessionToken();
  closeShareOverlay();
  closeTabletActionMenus();
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
  closeTabletActionMenus();
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
  if (window.QRious) {
    renderQrIntoCanvas(elements.shareQrCanvas, shareUrl, {
      foreground: "#111111",
      background: "#f7f9fc",
      level: "M",
    });

    state.activeQrDataUrl = elements.shareQrCanvas.toDataURL("image/png");
    return;
  }

  const canvasSize = getShareQrAvailableSize(elements.shareQrCanvas);

  if (window.QRCode && typeof window.QRCode.toCanvas === "function") {
    await window.QRCode.toCanvas(elements.shareQrCanvas, shareUrl, {
      width: canvasSize,
      margin: 0,
      color: {
        dark: "#111111",
        light: "#f7f9fc",
      },
    });

    if (typeof window.QRCode.toDataURL === "function") {
      state.activeQrDataUrl = await window.QRCode.toDataURL(shareUrl, {
        width: 720,
        margin: 0,
        color: {
          dark: "#111111",
          light: "#f7f9fc",
        },
      });
      return;
    }

    state.activeQrDataUrl = elements.shareQrCanvas.toDataURL("image/png");
    return;
  }

  throw new Error("QRCode library is unavailable.");
}

function renderQrIntoCanvas(canvas, value, {
  foreground = "#111111",
  background = "#f7f9fc",
  level = "M",
} = {}) {
  if (!canvas || !window.QRious) {
    return;
  }

  const canvasSize = resolveQrCanvasSize(canvas, value, { level });
  canvas.style.width = `${canvasSize}px`;
  canvas.style.height = `${canvasSize}px`;
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  new window.QRious({
    element: canvas,
    value,
    size: canvasSize,
    level,
    padding: 0,
    foreground,
    background,
  });
}

function resolveQrCanvasSize(canvas, value, {
  level = "M",
} = {}) {
  const availableSize = getShareQrAvailableSize(canvas);
  const moduleCount = inferQrModuleCount(value, { level });

  if (!moduleCount) {
    return availableSize;
  }

  const moduleSize = Math.max(1, Math.floor(availableSize / moduleCount));
  return Math.max(moduleCount, moduleCount * moduleSize);
}

function getShareQrAvailableSize(canvas) {
  const frame = canvas.closest(".share-panel__qr-frame");

  if (frame instanceof HTMLElement) {
    const styles = window.getComputedStyle(frame);
    const availableWidth = frame.clientWidth
      - parseFloat(styles.paddingLeft || "0")
      - parseFloat(styles.paddingRight || "0");
    const availableHeight = frame.clientHeight
      - parseFloat(styles.paddingTop || "0")
      - parseFloat(styles.paddingBottom || "0");
    const nextSize = Math.min(availableWidth || 0, availableHeight || availableWidth || 0);

    if (nextSize > 0) {
      return Math.max(64, Math.round(nextSize));
    }
  }

  return Math.max(64, Math.min(canvas.width || 280, canvas.height || 280));
}

function inferQrModuleCount(value, {
  level = "M",
} = {}) {
  if (!window.QRious) {
    return 0;
  }

  const probeCanvas = document.createElement("canvas");

  new window.QRious({
    element: probeCanvas,
    value,
    size: 997,
    level,
    padding: 0,
    foreground: "#000000",
    background: "#ffffff",
  });

  const context = probeCanvas.getContext("2d");

  if (!context) {
    return 0;
  }

  const { data, width } = context.getImageData(0, 0, probeCanvas.width, probeCanvas.height);
  let firstDarkX = -1;
  let lastDarkX = -1;

  for (let x = 0; x < width; x += 1) {
    const offset = x * 4;
    const isDark = data[offset] < 128;

    if (isDark) {
      if (firstDarkX === -1) {
        firstDarkX = x;
      }
      lastDarkX = x;
    }
  }

  if (firstDarkX === -1 || lastDarkX === -1) {
    return 0;
  }

  let moduleSize = 0;

  for (let x = firstDarkX; x <= lastDarkX; x += 1) {
    const offset = x * 4;
    const isDark = data[offset] < 128;

    if (isDark) {
      moduleSize += 1;
    } else if (moduleSize > 0) {
      break;
    }
  }

  if (moduleSize <= 0) {
    return 0;
  }

  return Math.round((lastDarkX - firstDarkX + 1) / moduleSize);
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
      throw createTeacherRequestError(response, "Zuweisung konnte nicht entfernt werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to remove set assignment:", error);
    showTeacherActionError(typeof error?.message === "string" ? error.message : "Zuweisung konnte nicht entfernt werden.");
  }
}

async function handleResetAccessSession(tabletId) {
  try {
    const response = await requestJson(`/api/tablets/${encodeURIComponent(tabletId)}/reset-access-session`, {
      auth: "teacher",
      method: "POST",
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "Timeout konnte nicht aufgehoben werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to reset access session:", error);
    showTeacherActionError(typeof error?.message === "string" ? error.message : "Timeout konnte nicht aufgehoben werden.");
  }
}

async function handleResetTabletPin(tablet) {
  const label = tablet.label || tablet.id;
  const nextPin = window.prompt(
    `Neuen PIN für ${label} eingeben.\n\nDie Kopplung, Lernsets und Lernstände bleiben erhalten.`,
    "",
  );

  if (nextPin === null) {
    return;
  }

  const pin = nextPin.trim();

  if (!/^[0-9]{4,8}$/.test(pin)) {
    window.alert("PIN muss aus 4 bis 8 Ziffern bestehen.");
    return;
  }

  try {
    const response = await requestJson(`/api/tablets/${encodeURIComponent(tablet.id)}/reset-pin`, {
      auth: "teacher",
      method: "POST",
      body: { pin },
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "PIN konnte nicht zurückgesetzt werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to reset tablet pin:", error);
    showTeacherActionError(typeof error?.message === "string" ? error.message : "PIN konnte nicht zurückgesetzt werden.");
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
    showTeacherActionError(typeof error?.message === "string" ? error.message : "Kopplung konnte nicht gelöscht werden.");
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

function formatDuration(durationMs) {
  const safeDurationMs = Math.max(0, Math.ceil(durationMs));

  if (safeDurationMs >= 60 * 1000) {
    const minutes = Math.ceil(safeDurationMs / (60 * 1000));
    return `${minutes} Minute${minutes === 1 ? "" : "n"}`;
  }

  const seconds = Math.max(1, Math.ceil(safeDurationMs / 1000));
  return `${seconds} Sekunde${seconds === 1 ? "" : "n"}`;
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
