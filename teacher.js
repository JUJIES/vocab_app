const SET_INDEX_API_PATH = "/api/sets";
const STUDENT_PAGE_NAME = "index.html";
const LERNDECK_ICON_PATH = "./assets/icons/lerndeck-stack.svg";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const STATUS_CONNECTED_ICON_PATH = "./assets/icons/status-connected.svg";
const STATUS_DISCONNECTED_ICON_PATH = "./assets/icons/status-disconnected.svg";
const PENCIL_ICON_PATH = "./assets/icons/pencil.svg";
const EXTERNAL_LINK_ICON_PATH = "./assets/icons/external-link.svg";
const REMOVE_ICON_PATH = "./assets/icons/x.svg";
const BROKEN_LINK_ICON_PATH = "./assets/icons/broken-link.svg";
const TIMEOUT_ICON_PATH = "./assets/icons/timeout.svg";
const PASSWORD_ICON_PATH = "./assets/icons/password-svgrepo-com.svg";
const LAST_TEACHER_STORAGE_KEY = "lerndeck-last-teacher-v1";

const state = {
  sets: [],
  tablets: [],
  activeTab: "sets",
  setPanels: {},
  publicOrigin: "",
  activeSet: null,
  activeShareUrl: "",
  feedbackTimeoutId: null,
  authReady: false,
  teacherAccounts: [],
  currentTeacher: null,
  importConfigured: false,
  editorSetId: "",
  editorView: "choice",
  editorImportMode: "replace",
  editorImportReturnView: "choice",
  editorFiles: [],
  editorCards: [],
  editorMetadata: {
    sourceLanguage: "de",
    targetLanguage: "en",
  },
};

const TEACHER_TAB_COPY = {
  sets: {
    title: "Lernsets",
    message: "Lernsets verwalten, teilen und ihre Nutzung auf Tablets sehen.",
    iconPath: LERNDECK_ICON_PATH,
  },
  tablets: {
    title: "Tablets",
    message: "Geräte prüfen, aktive Login-Timeouts sehen und Kopplungen bewusst zurücksetzen.",
    iconPath: TABLET_ICON_PATH,
  },
};

const elements = {
  authPanel: document.getElementById("teacher-auth-panel"),
  authForm: document.getElementById("teacher-auth-form"),
  authAccountSelect: document.getElementById("teacher-account-select"),
  authPasswordInput: document.getElementById("teacher-password-input"),
  authSubmit: document.getElementById("teacher-auth-submit"),
  authFeedback: document.getElementById("teacher-auth-feedback"),
  shell: document.getElementById("teacher-shell"),
  shellIcon: document.getElementById("teacher-shell-icon"),
  shellTitle: document.getElementById("teacher-shell-title"),
  shellMessage: document.getElementById("teacher-shell-message"),
  accountStatus: document.getElementById("teacher-account-status"),
  profileName: document.getElementById("teacher-profile-name"),
  logoutButton: document.getElementById("teacher-logout-button"),
  settingsButton: document.getElementById("teacher-settings-button"),
  settingsMenu: document.getElementById("teacher-settings-menu"),
  changePasswordMenuButton: document.getElementById("change-password-menu-button"),
  passwordOverlay: document.getElementById("password-overlay"),
  passwordForm: document.getElementById("password-form"),
  currentPasswordInput: document.getElementById("current-password-input"),
  newPasswordInput: document.getElementById("new-password-input"),
  newPasswordConfirmationInput: document.getElementById("new-password-confirmation-input"),
  passwordFeedback: document.getElementById("password-feedback"),
  passwordSaveButton: document.getElementById("password-save-button"),
  passwordDialogClose: document.getElementById("password-dialog-close"),
  passwordDialogCancel: document.getElementById("password-dialog-cancel"),
  closePasswordTriggers: document.querySelectorAll("[data-close-password]"),
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
  shareCode: document.getElementById("share-code"),
  shareLink: document.getElementById("share-link"),
  shareQrCanvas: document.getElementById("share-qr-canvas"),
  copyLinkButton: document.getElementById("copy-link-button"),
  shareFeedback: document.getElementById("share-feedback"),
  shareCloseButton: document.getElementById("share-close-button"),
  closeShareTriggers: document.querySelectorAll("[data-close-share]"),
  createSetButton: document.getElementById("create-set-button"),
  setEditorOverlay: document.getElementById("set-editor-overlay"),
  setEditorPanel: document.getElementById("set-editor-panel"),
  setEditorTitle: document.getElementById("set-editor-title"),
  setEditorChoice: document.getElementById("set-editor-choice"),
  setEditorChooseManual: document.getElementById("set-editor-choose-manual"),
  setEditorChooseImport: document.getElementById("set-editor-choose-import"),
  setEditorClose: document.getElementById("set-editor-close"),
  setEditorCancel: document.getElementById("set-editor-cancel"),
  closeSetEditorTriggers: document.querySelectorAll("[data-close-set-editor]"),
  setEditorForm: document.getElementById("set-editor-form"),
  setEditorFeedback: document.getElementById("set-editor-feedback"),
  saveSetButton: document.getElementById("save-set-button"),
  setTitleInput: document.getElementById("set-title-input"),
  setSubjectInput: document.getElementById("set-subject-input"),
  setSourceLabelInput: document.getElementById("set-source-label-input"),
  setTargetLabelInput: document.getElementById("set-target-label-input"),
  setDescriptionInput: document.getElementById("set-description-input"),
  setCardList: document.getElementById("set-card-editor-list"),
  setCardCount: document.getElementById("set-card-count"),
  addCardButton: document.getElementById("add-card-button"),
  setImportSection: document.getElementById("set-import-section"),
  setImportDropzone: document.getElementById("set-import-dropzone"),
  setImportFiles: document.getElementById("set-import-files"),
  setImportText: document.getElementById("set-import-text"),
  setImportInstruction: document.getElementById("set-import-instruction"),
  setImportFileSummary: document.getElementById("set-import-file-summary"),
  setImportFeedback: document.getElementById("set-import-feedback"),
  setImportBack: document.getElementById("set-import-back"),
  setOpenImportButton: document.getElementById("set-open-import-button"),
  createImportDraftButton: document.getElementById("create-import-draft-button"),
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initializeTeacherApp();
});

function bindEvents() {
  elements.authForm.addEventListener("submit", handleTeacherAuthSubmit);
  elements.authAccountSelect.addEventListener("change", () => {
    elements.authFeedback.textContent = "";
  });
  elements.logoutButton.addEventListener("click", handleTeacherLogout);
  elements.settingsButton.addEventListener("click", toggleTeacherSettingsMenu);
  elements.changePasswordMenuButton.addEventListener("click", openPasswordDialog);
  elements.passwordForm.addEventListener("submit", handlePasswordChange);
  elements.passwordDialogClose.addEventListener("click", closePasswordDialog);
  elements.passwordDialogCancel.addEventListener("click", closePasswordDialog);
  elements.copyLinkButton.addEventListener("click", handleCopyLink);
  elements.shareCloseButton.addEventListener("click", closeShareOverlay);
  elements.createSetButton.addEventListener("click", openNewSetEditor);
  elements.setEditorClose.addEventListener("click", closeSetEditor);
  elements.setEditorCancel.addEventListener("click", closeSetEditor);
  elements.setEditorChooseManual.addEventListener("click", openManualSetEditor);
  elements.setEditorChooseImport.addEventListener("click", openInitialSetImport);
  elements.setOpenImportButton.addEventListener("click", openAppendSetImport);
  elements.setImportBack.addEventListener("click", returnFromSetImport);
  elements.setEditorForm.addEventListener("submit", handleSaveSet);
  elements.addCardButton.addEventListener("click", () => addEditorCard());
  elements.setImportFiles.addEventListener("change", () => {
    setEditorFiles(Array.from(elements.setImportFiles.files || []));
  });
  elements.createImportDraftButton.addEventListener("click", handleCreateImportDraft);

  for (const eventName of ["dragenter", "dragover"]) {
    elements.setImportDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.setImportDropzone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    elements.setImportDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.setImportDropzone.classList.remove("is-dragging");
    });
  }

  elements.setImportDropzone.addEventListener("drop", (event) => {
    setEditorFiles(Array.from(event.dataTransfer?.files || []));
  });

  for (const trigger of elements.closeShareTriggers) {
    trigger.addEventListener("click", closeShareOverlay);
  }

  for (const trigger of elements.closeSetEditorTriggers) {
    trigger.addEventListener("click", closeSetEditor);
  }

  for (const trigger of elements.closePasswordTriggers) {
    trigger.addEventListener("click", closePasswordDialog);
  }

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      setActiveTeacherTab(button.dataset.teacherTab || "sets");
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.passwordOverlay.hidden) {
        closePasswordDialog();
        return;
      }

      if (!elements.settingsMenu.hidden) {
        closeTeacherSettingsMenu();
        return;
      }

      if (!elements.shareOverlay.hidden) {
        closeShareOverlay();
        return;
      }

      if (!elements.setEditorOverlay.hidden) {
        closeSetEditor();
        return;
      }

      closeTabletActionMenus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".teacher-settings")) {
      closeTeacherSettingsMenu();
    }
    if (!(event.target instanceof Element) || !event.target.closest("[data-tablet-menu]")) {
      closeTabletActionMenus();
    }
  });
}

async function initializeTeacherApp() {
  state.publicOrigin = await loadTeacherShareOrigin();
  setActiveTeacherTab(state.activeTab);
  await loadTeacherAccounts();

  const sessionResponse = await requestJson("/api/teacher/session");
  if (sessionResponse.ok && sessionResponse.data?.session?.teacherId) {
    const publicAccount = state.teacherAccounts.find(
      (account) => account.id === sessionResponse.data.session.teacherId,
    );
    state.currentTeacher = {
      id: sessionResponse.data.session.teacherId,
      displayName: "Lehrkraft",
      ...publicAccount,
      ...sessionResponse.data?.teacher,
    };
    await loadProtectedTeacherData();
    return;
  }

  showTeacherAuth();
}

async function loadTeacherAccounts() {
  try {
    const response = await requestJson("/api/teacher/accounts");
    if (!response.ok) {
      throw new Error(response.data?.error || "Zugänge konnten nicht geladen werden.");
    }

    state.teacherAccounts = Array.isArray(response.data?.accounts) ? response.data.accounts : [];
    elements.authAccountSelect.replaceChildren(new Option("Zugang auswählen", ""));
    for (const account of state.teacherAccounts) {
      elements.authAccountSelect.append(new Option(account.displayName, account.id));
    }

    const rememberedTeacher = window.localStorage.getItem(LAST_TEACHER_STORAGE_KEY) || "";
    if (state.teacherAccounts.some((account) => account.id === rememberedTeacher)) {
      elements.authAccountSelect.value = rememberedTeacher;
    }
  } catch (error) {
    console.error("Unable to load teacher accounts:", error);
    elements.authFeedback.textContent = error.message || "Zugänge konnten nicht geladen werden.";
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
  const response = await requestJson(SET_INDEX_API_PATH, {
    auth: "teacher",
  });

  if (!response.ok) {
    throw createTeacherRequestError(response, "Set-Liste konnte nicht geladen werden.");
  }

  state.importConfigured = Boolean(response.data?.importConfigured);
  if (response.data?.teacher?.id) {
    const publicAccount = state.teacherAccounts.find((account) => account.id === response.data.teacher.id);
    state.currentTeacher = { ...state.currentTeacher, ...publicAccount, ...response.data.teacher };
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
    if (state.currentTeacher?.mustChangePassword) {
      openPasswordDialog();
    }
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
  const shareCode = typeof entry?.shareCode === "string" ? entry.shareCode.trim().toUpperCase() : "";
  const subject = typeof entry?.subject === "string" ? entry.subject.trim() : "";
  const category = typeof entry?.category === "string" ? entry.category.trim() : "";
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
    shareCode,
    subject,
    category,
    editable: Boolean(entry?.editable),
    cardCount: Number.isFinite(entry?.cardCount) ? Math.max(0, Math.trunc(entry.cardCount)) : 0,
    updatedAt: typeof entry?.updatedAt === "string" ? entry.updatedAt.trim() : "",
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
    isLocked: Boolean(entry?.isLocked),
    failedPinAttempts: Number.isFinite(entry?.failedPinAttempts)
      ? Math.max(0, Math.trunc(entry.failedPinAttempts))
      : 0,
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
  elements.setsMeta.textContent = state.sets.length === 1
    ? "1 Set"
    : `${state.sets.length} Sets`;
  elements.setList.append(createSetGroup(state.sets));
}

function createSetGroup(sets) {
  const group = document.createElement("section");
  group.className = "teacher-set-group";
  const list = document.createElement("div");
  list.className = "teacher-set-group__list";
  list.setAttribute("role", "list");
  for (const setEntry of sets) {
    list.append(createSetRow(setEntry));
  }
  group.append(list);
  return group;
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
  elements.shellIcon.src = copy.iconPath;
  elements.shellIcon.dataset.sectionIcon = state.activeTab;
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
  meta.textContent = [setEntry.subject, setEntry.cardCount ? `${setEntry.cardCount} Karten` : "", setEntry.description]
    .filter(Boolean)
    .join(" · ") || "Lernset";

  copy.append(title, meta, createTabletUsageBlock(setEntry));

  const actions = document.createElement("div");
  actions.className = "teacher-set-row__actions";

  if (setEntry.editable) {
    const editAction = document.createElement("button");
    editAction.className = "teacher-set-row__edit";
    editAction.type = "button";
    editAction.setAttribute("aria-label", `Set ${setEntry.title} bearbeiten`);
    editAction.title = "Bearbeiten";
    editAction.append(createButtonIcon(PENCIL_ICON_PATH));
    editAction.addEventListener("click", () => {
      void openEditSetEditor(setEntry);
    });
    actions.append(editAction);
  }

  const shareAction = document.createElement("button");
  shareAction.className = "teacher-set-row__share";
  shareAction.type = "button";
  shareAction.setAttribute("aria-label", `Set ${setEntry.title} teilen`);
  shareAction.title = "Teilen";
  shareAction.append(
    createButtonIcon(EXTERNAL_LINK_ICON_PATH),
  );
  shareAction.addEventListener("click", () => {
    openShareOverlay(setEntry);
  });
  actions.append(shareAction);

  row.append(copy, actions);
  return row;
}

function createTabletUsageBlock(setEntry) {
  const wrapper = document.createElement("div");
  wrapper.className = "teacher-set-row__tablets";

  if (setEntry.tablets.length === 0) {
    const summary = document.createElement("span");
    summary.className = "teacher-set-row__tablet-summary";
    summary.setAttribute("aria-label", "Noch kein Tablet hat dieses Set hinzugefügt");
    summary.append(createTabletUsageIcon(), document.createTextNode("0 Tablets"));
    wrapper.append(summary);
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
  toggle.setAttribute(
    "aria-label",
    `${setEntry.tablets.length} Tablet${setEntry.tablets.length === 1 ? " hat" : "s haben"} dieses Set hinzugefügt. Details anzeigen`,
  );

  const toggleLabel = document.createElement("span");
  toggleLabel.className = "teacher-set-row__toggle-label";
  toggleLabel.textContent = `${setEntry.tablets.length} Tablet${setEntry.tablets.length === 1 ? "" : "s"}`;

  const toggleChevron = document.createElement("span");
  toggleChevron.className = "teacher-set-row__toggle-chevron";
  toggleChevron.setAttribute("aria-hidden", "true");
  toggleChevron.textContent = "⌄";

  toggle.append(createTabletUsageIcon(), toggleLabel, toggleChevron);

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
    removeButton.textContent = "Vom Tablet entfernen";
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

function createTabletUsageIcon() {
  const icon = document.createElement("img");
  icon.className = "teacher-set-row__usage-icon";
  icon.src = TABLET_ICON_PATH;
  icon.alt = "";
  icon.decoding = "async";
  return icon;
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

  if (tablet.isLocked) {
    status.classList.add("teacher-status-badge--warning", "teacher-status-badge--locked");
    status.textContent = "PIN gesperrt";
    return status;
  }

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
  releaseAction.disabled = !tablet.accessSession?.isBound && !tablet.isLocked;
  releaseAction.append(
    createButtonIcon(TIMEOUT_ICON_PATH),
    document.createTextNode(tablet.isLocked ? "Sperre aufheben" : "Freigabe aufheben"),
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

  return false;
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

function createTeacherRequestError(response, fallbackMessage) {
  const error = new Error(response.data?.error || fallbackMessage);
  error.code = response.data?.code || "";
  error.requiresAuth = response.status === 401 || response.status === 403;
  return error;
}

function showTeacherAuth(feedback = "") {
  closeShareOverlay();
  closeSetEditor();
  closePasswordDialog();
  closeTeacherSettingsMenu();
  closeTabletActionMenus();
  state.authReady = false;
  state.currentTeacher = null;
  elements.authPanel.hidden = false;
  elements.shell.hidden = true;
  elements.authFeedback.textContent = feedback;
  elements.authPasswordInput.value = "";
  requestAnimationFrame(() => {
    if (elements.authAccountSelect.value) {
      elements.authPasswordInput.focus();
    } else {
      elements.authAccountSelect.focus();
    }
  });
}

function showTeacherShell() {
  state.authReady = true;
  elements.authPanel.hidden = true;
  elements.shell.hidden = false;
  elements.authFeedback.textContent = "";
  const displayName = state.currentTeacher?.displayName || "Lehrkraft";
  elements.profileName.textContent = displayName;
  elements.accountStatus.setAttribute("aria-label", `Angemeldet als ${displayName}`);
  closeTeacherSettingsMenu();
  closeTabletActionMenus();
}

function toggleTeacherSettingsMenu() {
  const shouldOpen = elements.settingsMenu.hidden;
  elements.settingsMenu.hidden = !shouldOpen;
  elements.settingsButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  if (shouldOpen) {
    requestAnimationFrame(() => elements.changePasswordMenuButton.focus());
  }
}

function closeTeacherSettingsMenu() {
  elements.settingsMenu.hidden = true;
  elements.settingsButton.setAttribute("aria-expanded", "false");
}

function openPasswordDialog() {
  closeTeacherSettingsMenu();
  elements.passwordForm.reset();
  elements.passwordFeedback.textContent = "";
  elements.passwordOverlay.hidden = false;
  document.body.classList.add("has-modal-open");
  requestAnimationFrame(() => elements.currentPasswordInput.focus());
}

function closePasswordDialog() {
  elements.passwordOverlay.hidden = true;
  elements.passwordForm.reset();
  elements.passwordFeedback.textContent = "";
  if (elements.shareOverlay.hidden && elements.setEditorOverlay.hidden) {
    document.body.classList.remove("has-modal-open");
  }
}

async function openShareOverlay(setEntry) {
  state.activeSet = setEntry;
  state.activeShareUrl = buildStudentShareUrl(setEntry);
  elements.shareTitle.textContent = setEntry.title;
  elements.shareCode.textContent = setEntry.shareCode || "";
  elements.sharePath.hidden = !setEntry.shareCode;
  elements.shareLink.value = state.activeShareUrl;
  elements.shareFeedback.textContent = "";
  elements.shareOverlay.hidden = false;
  document.body.classList.add("has-modal-open");

  try {
    await renderShareQr(state.activeShareUrl);
  } catch (error) {
    console.error("Unable to render QR code:", error);
    elements.shareFeedback.textContent = "QR-Code fehlt.";
    clearQrCanvas();
  }
}

function closeShareOverlay() {
  elements.shareOverlay.hidden = true;
  elements.sharePath.hidden = true;
  elements.shareFeedback.textContent = "";
  if (elements.setEditorOverlay.hidden && elements.passwordOverlay.hidden) {
    document.body.classList.remove("has-modal-open");
  }
}

function buildStudentShareUrl(setEntry) {
  const url = new URL(STUDENT_PAGE_NAME, `${state.publicOrigin || window.location.origin}/`);
  if (setEntry.shareCode) {
    url.searchParams.set("code", setEntry.shareCode);
  } else {
    url.searchParams.set("set", setEntry.path);
  }
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

  recenterRenderedQrContent(canvas, { background });
}

function measureQrDarkContentBounds(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (alpha > 0 && red < 120 && green < 120 && blue < 120) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    right: width - maxX - 1,
    bottom: height - maxY - 1,
    width: (maxX - minX) + 1,
    height: (maxY - minY) + 1,
  };
}

function recenterRenderedQrContent(canvas, {
  background = "#ffffff",
} = {}) {
  const bounds = measureQrDarkContentBounds(canvas);

  if (!bounds) {
    return;
  }

  const usedWidth = Math.min(canvas.width, bounds.width + (bounds.left * 2));
  const usedHeight = Math.min(canvas.height, bounds.height + (bounds.top * 2));
  const horizontalSlack = canvas.width - usedWidth;
  const verticalSlack = canvas.height - usedHeight;

  if (horizontalSlack <= 1 && verticalSlack <= 1) {
    return;
  }

  const centeredX = Math.round(horizontalSlack / 2);
  const centeredY = Math.round(verticalSlack / 2);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  const tempContext = tempCanvas.getContext("2d");
  const targetContext = canvas.getContext("2d");

  if (!tempContext || !targetContext) {
    return;
  }

  tempContext.fillStyle = background;
  tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempContext.drawImage(
    canvas,
    0,
    0,
    usedWidth,
    usedHeight,
    centeredX,
    centeredY,
    usedWidth,
    usedHeight,
  );

  targetContext.clearRect(0, 0, canvas.width, canvas.height);
  targetContext.drawImage(tempCanvas, 0, 0);
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
      throw createTeacherRequestError(response, "Set konnte nicht vom Tablet entfernt werden.");
    }

    await reloadTeacherData();
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }

    console.error("Unable to remove set assignment:", error);
    showTeacherActionError(typeof error?.message === "string" ? error.message : "Set konnte nicht vom Tablet entfernt werden.");
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

function openNewSetEditor() {
  state.editorSetId = "";
  state.editorCards = [];
  state.editorMetadata = { sourceLanguage: "de", targetLanguage: "en" };
  elements.setEditorTitle.textContent = "Neues Set";
  elements.setTitleInput.value = "";
  elements.setSubjectInput.value = "";
  elements.setDescriptionInput.value = "";
  elements.setSourceLabelInput.value = "Begriff";
  elements.setTargetLabelInput.value = "Übersetzung oder Definition";
  elements.setEditorFeedback.textContent = "";
  resetSetImportInputs();
  elements.setEditorOverlay.hidden = false;
  document.body.classList.add("has-modal-open");
  showSetEditorView("choice");
}

async function openEditSetEditor(setEntry) {
  try {
    const response = await requestJson(`/api/teacher/sets/${encodeURIComponent(setEntry.id)}`, {
      auth: "teacher",
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Set konnte nicht geladen werden.");
    }

    const editableSet = response.data?.set;
    state.editorSetId = editableSet.id;
    state.editorCards = Array.isArray(editableSet.cards)
      ? editableSet.cards.map(normalizeEditorCard).filter(Boolean)
      : [];
    state.editorMetadata = {
      sourceLanguage: editableSet.sourceLanguage || "de",
      targetLanguage: editableSet.targetLanguage || "en",
    };
    elements.setEditorTitle.textContent = "Set bearbeiten";
    elements.setTitleInput.value = editableSet.title || "";
    elements.setSubjectInput.value = editableSet.subject || "";
    elements.setDescriptionInput.value = editableSet.description || "";
    elements.setSourceLabelInput.value = editableSet.sourceLabel || "Begriff";
    elements.setTargetLabelInput.value = editableSet.targetLabel || "Übersetzung oder Definition";
    elements.setEditorFeedback.textContent = "";
    resetSetImportInputs();
    if (state.editorCards.length === 0) {
      state.editorCards.push(createEmptyEditorCard());
    }
    renderEditorCards();
    elements.setEditorOverlay.hidden = false;
    document.body.classList.add("has-modal-open");
    showSetEditorView("manual");
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    showTeacherActionError(error.message || "Set konnte nicht geladen werden.");
  }
}

function closeSetEditor() {
  elements.setEditorOverlay.hidden = true;
  elements.setEditorFeedback.textContent = "";
  elements.setImportFeedback.textContent = "";
  if (elements.shareOverlay.hidden && elements.passwordOverlay.hidden) {
    document.body.classList.remove("has-modal-open");
  }
}

function showSetEditorView(view) {
  const nextView = ["choice", "manual", "import"].includes(view) ? view : "manual";
  state.editorView = nextView;
  elements.setEditorPanel.dataset.editorView = nextView;
  elements.setEditorChoice.hidden = nextView !== "choice";
  elements.setEditorForm.hidden = nextView !== "manual";
  elements.setImportSection.hidden = nextView !== "import";

  requestAnimationFrame(() => {
    if (nextView === "choice") {
      elements.setEditorChooseManual.focus();
    } else if (nextView === "import") {
      elements.setImportText.focus();
    } else {
      elements.setTitleInput.focus();
    }
  });
}

function openManualSetEditor() {
  if (state.editorCards.length === 0) {
    state.editorCards.push(createEmptyEditorCard());
    renderEditorCards();
  }
  showSetEditorView("manual");
}

function openInitialSetImport() {
  state.editorImportMode = "replace";
  state.editorImportReturnView = "choice";
  elements.setImportFeedback.textContent = "";
  showSetEditorView("import");
}

function openAppendSetImport() {
  state.editorImportMode = "append";
  state.editorImportReturnView = "manual";
  elements.setImportFeedback.textContent = "";
  showSetEditorView("import");
}

function returnFromSetImport() {
  showSetEditorView(state.editorImportReturnView);
}

function resetSetImportInputs() {
  state.editorFiles = [];
  elements.setImportText.value = "";
  elements.setImportInstruction.value = "";
  elements.setImportFiles.value = "";
  elements.setImportFeedback.textContent = "";
  setEditorFiles([]);
}

function createEmptyEditorCard() {
  return {
    id: "",
    front: "",
    back: "",
    initialBack: "",
    acceptedAnswers: [],
  };
}

function normalizeEditorCard(card) {
  if (!card || typeof card !== "object") {
    return null;
  }
  const back = typeof card.back === "string" ? card.back : "";
  return {
    id: typeof card.id === "string" ? card.id : "",
    front: typeof card.front === "string" ? card.front : "",
    back,
    initialBack: back,
    acceptedAnswers: Array.isArray(card.acceptedAnswers)
      ? card.acceptedAnswers.filter((answer) => typeof answer === "string" && answer.trim())
      : [],
  };
}

function addEditorCard(card = createEmptyEditorCard()) {
  state.editorCards.push(normalizeEditorCard(card) || createEmptyEditorCard());
  renderEditorCards();
  requestAnimationFrame(() => {
    const rows = elements.setCardList.querySelectorAll(".set-card-editor-row");
    rows[rows.length - 1]?.querySelector("input")?.focus();
  });
}

function renderEditorCards() {
  elements.setCardList.replaceChildren();
  elements.setCardCount.textContent = `${state.editorCards.length} Karte${state.editorCards.length === 1 ? "" : "n"}`;

  const columns = document.createElement("div");
  columns.className = "set-card-editor-columns";
  columns.setAttribute("aria-hidden", "true");
  for (const labelText of ["", "Vorderseite", "Rückseite", ""]) {
    const label = document.createElement("span");
    label.textContent = labelText;
    columns.append(label);
  }
  elements.setCardList.append(columns);

  state.editorCards.forEach((card, index) => {
    const row = document.createElement("article");
    row.className = "set-card-editor-row";

    const number = document.createElement("span");
    number.className = "set-card-editor-row__number";
    number.textContent = String(index + 1);

    const front = createEditorInput("Vorderseite", card.front, (value) => {
      card.front = value;
    }, { compact: true });
    const back = createEditorInput("Rückseite", card.back, (value) => {
      card.back = value;
    }, { compact: true });

    const remove = document.createElement("button");
    remove.className = "set-card-editor-row__remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Karte ${index + 1} entfernen`);
    remove.title = "Karte entfernen";
    remove.append(createButtonIcon(REMOVE_ICON_PATH));
    remove.addEventListener("click", () => {
      state.editorCards.splice(index, 1);
      if (state.editorCards.length === 0) {
        state.editorCards.push(createEmptyEditorCard());
      }
      renderEditorCards();
    });

    row.append(number, front, back, remove);
    elements.setCardList.append(row);
  });
}

function createEditorInput(labelText, value, onInput, { compact = false } = {}) {
  const label = document.createElement("label");
  label.className = compact ? "set-editor-field set-editor-field--card" : "set-editor-field";
  const labelCopy = document.createElement("span");
  labelCopy.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(labelCopy, input);
  return label;
}

function setEditorFiles(files) {
  state.editorFiles = files.slice(0, 4);
  elements.setImportFileSummary.textContent = state.editorFiles.length
    ? `${state.editorFiles.length} Datei${state.editorFiles.length === 1 ? "" : "en"} ausgewählt`
    : state.importConfigured
      ? ""
      : "KI-Import braucht OPENAI_API_KEY";
}

async function handleCreateImportDraft() {
  const text = elements.setImportText.value.trim();
  const instruction = elements.setImportInstruction.value.trim();
  if (!text && state.editorFiles.length === 0) {
    elements.setImportFeedback.textContent = "Bitte Text einfügen oder eine Datei auswählen.";
    return;
  }

  elements.createImportDraftButton.disabled = true;
  elements.setImportFeedback.textContent = "Material wird verarbeitet …";
  try {
    const files = await Promise.all(state.editorFiles.map(readImportFile));
    const response = await requestJson("/api/teacher/import-draft", {
      method: "POST",
      auth: "teacher",
      body: { text, instruction, files },
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Material konnte nicht verarbeitet werden.");
    }

    const importedCardCount = applyImportDraft(response.data?.draft);
    const wasAppended = state.editorImportMode === "append";
    resetSetImportInputs();
    showSetEditorView("manual");
    elements.setEditorFeedback.textContent = response.data?.importMethod === "openai"
      ? `${importedCardCount} Karte${importedCardCount === 1 ? "" : "n"} automatisch ${wasAppended ? "hinzugefügt" : "erstellt"}. Bitte kurz prüfen.`
      : `${importedCardCount} Karte${importedCardCount === 1 ? "" : "n"} ${wasAppended ? "hinzugefügt" : "übernommen"}. Bitte kurz prüfen.`;
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    console.error("Unable to import material:", error);
    elements.setImportFeedback.textContent = error.message || "Material konnte nicht verarbeitet werden.";
  } finally {
    elements.createImportDraftButton.disabled = false;
  }
}

function applyImportDraft(draft) {
  if (!draft || !Array.isArray(draft.cards)) {
    throw new Error("Der Entwurf enthält keine Karten.");
  }
  const importedCards = draft.cards.map(normalizeEditorCard).filter(Boolean);

  if (importedCards.length === 0) {
    throw new Error("Der Entwurf enthält keine vollständigen Karten.");
  }

  const shouldAppend = state.editorImportMode === "append";

  if (shouldAppend) {
    const existingCards = state.editorCards.filter((card) => card.front.trim() || card.back.trim());
    state.editorCards = [...existingCards, ...importedCards];

    if (!state.editorSetId) {
      elements.setTitleInput.value = elements.setTitleInput.value || draft.title || "Neues Lernset";
      elements.setSubjectInput.value = elements.setSubjectInput.value || draft.subject || "";
      elements.setDescriptionInput.value = elements.setDescriptionInput.value || draft.description || "";
      if (elements.setSourceLabelInput.value === "Begriff") {
        elements.setSourceLabelInput.value = draft.sourceLabel || "Begriff";
      }
      if (elements.setTargetLabelInput.value === "Übersetzung oder Definition") {
        elements.setTargetLabelInput.value = draft.targetLabel || "Übersetzung oder Definition";
      }
      state.editorMetadata = {
        sourceLanguage: draft.sourceLanguage || state.editorMetadata.sourceLanguage || "de",
        targetLanguage: draft.targetLanguage || state.editorMetadata.targetLanguage || "en",
      };
    }
  } else {
    elements.setTitleInput.value = draft.title || elements.setTitleInput.value || "Neues Lernset";
    elements.setSubjectInput.value = draft.subject || "";
    elements.setDescriptionInput.value = draft.description || "";
    elements.setSourceLabelInput.value = draft.sourceLabel || "Begriff";
    elements.setTargetLabelInput.value = draft.targetLabel || "Übersetzung oder Definition";
    state.editorMetadata = {
      sourceLanguage: draft.sourceLanguage || "de",
      targetLanguage: draft.targetLanguage || "en",
    };
    state.editorCards = importedCards;
  }

  renderEditorCards();
  return importedCards.length;
}

function readImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error(`${file.name} konnte nicht gelesen werden.`)));
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separatorIndex = result.indexOf(",");
      resolve({
        name: file.name,
        type: inferImportFileType(file),
        data: separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result,
      });
    });
    reader.readAsDataURL(file);
  });
}

function inferImportFileType(file) {
  if (file.type) {
    return file.type.toLowerCase();
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  return {
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }[extension] || "application/octet-stream";
}

async function handleSaveSet(event) {
  event.preventDefault();
  const preparedCards = state.editorCards.map((card) => ({
      id: card.id,
      front: card.front.trim(),
      back: card.back.trim(),
      acceptedAnswers: [
        card.back.trim(),
        ...card.acceptedAnswers
          .map((answer) => answer.trim())
          .filter((answer) => answer && (answer !== card.initialBack || answer === card.back.trim())),
      ],
    }));
  const incompleteCardIndex = preparedCards.findIndex((card) => Boolean(card.front) !== Boolean(card.back));
  if (incompleteCardIndex >= 0) {
    elements.setEditorFeedback.textContent = `Karte ${incompleteCardIndex + 1} ist noch unvollständig.`;
    return;
  }
  const cards = preparedCards.filter((card) => card.front && card.back);

  if (!elements.setTitleInput.value.trim()) {
    elements.setEditorFeedback.textContent = "Bitte einen Titel eingeben.";
    elements.setTitleInput.focus();
    return;
  }
  if (cards.length === 0) {
    elements.setEditorFeedback.textContent = "Mindestens eine vollständige Karte ist erforderlich.";
    return;
  }

  const payload = {
    title: elements.setTitleInput.value,
    subject: elements.setSubjectInput.value,
    description: elements.setDescriptionInput.value,
    sourceLabel: elements.setSourceLabelInput.value,
    targetLabel: elements.setTargetLabelInput.value,
    sourceLanguage: state.editorMetadata.sourceLanguage,
    targetLanguage: state.editorMetadata.targetLanguage,
    cards,
  };
  const path = state.editorSetId
    ? `/api/teacher/sets/${encodeURIComponent(state.editorSetId)}`
    : "/api/teacher/sets";

  elements.saveSetButton.disabled = true;
  elements.setEditorFeedback.textContent = "Wird gespeichert …";
  try {
    const response = await requestJson(path, {
      method: state.editorSetId ? "PUT" : "POST",
      auth: "teacher",
      body: payload,
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Set konnte nicht gespeichert werden.");
    }
    await reloadTeacherData();
    closeSetEditor();
    const savedSet = normalizeSetEntry(response.data?.set);
    if (savedSet) {
      await openShareOverlay(savedSet);
    }
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    console.error("Unable to save set:", error);
    elements.setEditorFeedback.textContent = error.message || "Set konnte nicht gespeichert werden.";
  } finally {
    elements.saveSetButton.disabled = false;
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
  const teacherId = String(formData.get("teacher-id") || "").trim();
  const password = String(formData.get("teacher-password") || "");
  const account = state.teacherAccounts.find((entry) => entry.id === teacherId);

  if (!account) {
    elements.authFeedback.textContent = "Bitte einen Zugang auswählen.";
    return;
  }

  if (!password) {
    elements.authFeedback.textContent = "Bitte Passwort eingeben.";
    return;
  }

  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await requestJson("/api/teacher/session", {
      method: "POST",
      body: { teacherId, password },
    });

    if (!response.ok) {
      throw createTeacherRequestError(response, "Anmeldung konnte nicht abgeschlossen werden.");
    }

    state.currentTeacher = response.data?.teacher || response.data?.session?.teacher || account;
    window.localStorage.setItem(LAST_TEACHER_STORAGE_KEY, teacherId);
    await loadProtectedTeacherData();
  } catch (error) {
    console.error("Unable to unlock teacher page:", error);
    showTeacherAuth(typeof error?.message === "string" ? error.message : "Anmeldung konnte nicht abgeschlossen werden.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const currentPassword = elements.currentPasswordInput.value;
  const newPassword = elements.newPasswordInput.value;
  const confirmation = elements.newPasswordConfirmationInput.value;

  if (!currentPassword) {
    elements.passwordFeedback.textContent = "Bitte das aktuelle Passwort eingeben.";
    elements.currentPasswordInput.focus();
    return;
  }
  if (newPassword.length < 8) {
    elements.passwordFeedback.textContent = "Das neue Passwort braucht mindestens 8 Zeichen.";
    elements.newPasswordInput.focus();
    return;
  }
  if (newPassword !== confirmation) {
    elements.passwordFeedback.textContent = "Die neuen Passwörter stimmen nicht überein.";
    elements.newPasswordConfirmationInput.focus();
    return;
  }

  elements.passwordSaveButton.disabled = true;
  elements.passwordFeedback.textContent = "Passwort wird geändert …";
  try {
    const response = await requestJson("/api/teacher/password", {
      method: "POST",
      auth: "teacher",
      body: { currentPassword, newPassword },
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Passwort konnte nicht geändert werden.");
    }

    state.currentTeacher = response.data?.teacher || state.currentTeacher;
    closePasswordDialog();
  } catch (error) {
    if (error?.requiresAuth && error?.code !== "INVALID_CURRENT_PASSWORD") {
      showTeacherAuth(error.message);
      return;
    }
    elements.passwordFeedback.textContent = error.message || "Passwort konnte nicht geändert werden.";
  } finally {
    elements.passwordSaveButton.disabled = false;
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
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    credentials: "same-origin",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
