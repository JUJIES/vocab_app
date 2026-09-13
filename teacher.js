const SET_INDEX_API_PATH = "/api/sets";
const STUDENT_PAGE_NAME = "index.html";
const LERNDECK_ICON_PATH = "./assets/icons/lerndeck-stack.svg";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const STATUS_CONNECTED_ICON_PATH = "./assets/icons/status-connected.svg";
const STATUS_DISCONNECTED_ICON_PATH = "./assets/icons/status-disconnected.svg";
const PENCIL_ICON_PATH = "./assets/icons/pencil.svg";
const EXTERNAL_LINK_ICON_PATH = "./assets/icons/external-link.svg";
const DELETE_ICON_PATH = "./assets/icons/trash-2.svg";
const REMOVE_ICON_PATH = "./assets/icons/x.svg";
const IMAGE_PLUS_ICON_PATH = "./assets/icons/image-plus.svg";
const TEACHER_PRACTICE_ICON_PATH = "./assets/icons/learning-modes-open.svg";
const PRINT_ICON_PATH = "./assets/icons/print.svg";
const BROKEN_LINK_ICON_PATH = "./assets/icons/broken-link.svg";
const TIMEOUT_ICON_PATH = "./assets/icons/timeout.svg";
const PASSWORD_ICON_PATH = "./assets/icons/password-svgrepo-com.svg";
const LAST_TEACHER_STORAGE_KEY = "lerndeck-last-teacher-v1";
const ADMIN_SET_GROUP_STORAGE_KEY = "lerndeck-admin-set-groups-v1";
const TAFELRAUM_EMBED = window.self !== window.top
  && new URLSearchParams(window.location.search).get("embed") === "tafelraum";

const state = {
  sets: [],
  tablets: [],
  activeTab: "sets",
  setPanels: {},
  publicOrigin: "",
  activeSet: null,
  pendingDeleteSet: null,
  activeShareUrl: "",
  feedbackTimeoutId: null,
  authReady: false,
  teacherAccounts: [],
  currentTeacher: null,
  importConfigured: false,
  visualConfigured: false,
  visualJobs: [],
  visualAssetsByCard: {},
  visualPollTimerId: null,
  editorSetId: "",
  editorSetStatus: "draft",
  editorDraftVersion: 0,
  editorSavedDraftVersion: 0,
  editorAutosaveTimerId: null,
  editorAutosavePromise: null,
  editorView: "choice",
  editorImportMode: "replace",
  editorImportReturnView: "choice",
  editorFiles: [],
  editorFilePreviewUrls: [],
  editorCards: [],
  editorMetadata: { sourceLanguage: "", targetLanguage: "" },
  editorSideSelection: { front: "", back: "" },
  printSet: null,
  printKind: "",
  printDirection: "source-target",
  printSelectedCardIds: [],
  printPdfUrl: "",
  printPreviewTimerId: null,
  printPreviewRequestId: 0,
  printPreviewAbortController: null,
  printTestDraft: null,
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
  profileRole: document.getElementById("teacher-profile-role"),
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
  printOverlay: document.getElementById("print-overlay"),
  printTitle: document.getElementById("print-title"),
  printCloseButton: document.getElementById("print-close-button"),
  closePrintTriggers: document.querySelectorAll("[data-close-print]"),
  printModeView: document.getElementById("print-mode-view"),
  printModeButtons: document.querySelectorAll("[data-print-kind]"),
  printModeFeedback: document.getElementById("print-mode-feedback"),
  printWorkspace: document.getElementById("print-workspace"),
  printBackButton: document.getElementById("print-back-button"),
  printDirectionSelect: document.getElementById("print-direction-select"),
  printSwapDirection: document.getElementById("print-swap-direction"),
  printLayout: document.getElementById("print-layout"),
  printConfig: document.getElementById("print-config"),
  printSelectionCount: document.getElementById("print-selection-count"),
  printCardList: document.getElementById("print-card-list"),
  printPreviewLoading: document.getElementById("print-preview-loading"),
  printPreview: document.getElementById("print-preview"),
  printPaper: document.getElementById("print-paper"),
  printFeedback: document.getElementById("print-feedback"),
  printDownloadButton: document.getElementById("print-download-button"),
  deleteSetOverlay: document.getElementById("delete-set-overlay"),
  deleteSetCopy: document.getElementById("delete-set-copy"),
  deleteSetFeedback: document.getElementById("delete-set-feedback"),
  deleteSetCancel: document.getElementById("delete-set-cancel"),
  deleteSetConfirm: document.getElementById("delete-set-confirm"),
  closeDeleteSetTriggers: document.querySelectorAll("[data-close-delete-set]"),
  createSetButton: document.getElementById("create-set-button"),
  setEditorOverlay: document.getElementById("set-editor-overlay"),
  setEditorPanel: document.getElementById("set-editor-panel"),
  setEditorTitle: document.getElementById("set-editor-title"),
  setEditorStatus: document.getElementById("set-editor-status"),
  setEditorChoice: document.getElementById("set-editor-choice"),
  setEditorChooseManual: document.getElementById("set-editor-choose-manual"),
  setEditorChooseImport: document.getElementById("set-editor-choose-import"),
  setEditorClose: document.getElementById("set-editor-close"),
  setEditorCancel: document.getElementById("set-editor-cancel"),
  setEditorForm: document.getElementById("set-editor-form"),
  setEditorFeedback: document.getElementById("set-editor-feedback"),
  saveSetButton: document.getElementById("save-set-button"),
  setTitleInput: document.getElementById("set-title-input"),
  setSubjectInput: document.getElementById("set-subject-input"),
  setSourceLabelInput: document.getElementById("set-source-label-input"),
  setTargetLabelInput: document.getElementById("set-target-label-input"),
  setSideFeedback: document.getElementById("set-side-feedback"),
  setDescriptionInput: document.getElementById("set-description-input"),
  setCardList: document.getElementById("set-card-editor-list"),
  setCardCount: document.getElementById("set-card-count"),
  addCardButton: document.getElementById("add-card-button"),
  generateVisualsButton: document.getElementById("generate-visuals-button"),
  regenerateAllVisualsButton: document.getElementById("regenerate-all-visuals-button"),
  visualJobStatus: document.getElementById("visual-job-status"),
  setImportSection: document.getElementById("set-import-section"),
  setImportDropzone: document.getElementById("set-import-dropzone"),
  setImportFilePicker: document.getElementById("set-import-file-picker"),
  setImportPickerTitle: document.getElementById("set-import-picker-title"),
  setImportPreviewList: document.getElementById("set-import-preview-list"),
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
  installTafelraumBridge();
  bindEvents();
  void initializeTeacherApp().finally(() => {
    window.LerndeckPwa?.ready();
    window.LerndeckTafelraumEmbed?.ready();
  });
});

function installTafelraumBridge() {
  if (!TAFELRAUM_EMBED) return;
  const interactiveSelector = [
    "a[href]", "button", "input", "select", "summary", "textarea",
    "[contenteditable='true']", "[draggable='true']", "[data-tafelraum-interactive]",
    "[role='button']", "[role='checkbox']", "[role='combobox']", "[role='link']",
    "[role='listbox']", "[role='option']", "[role='radio']", "[role='slider']",
    "[role='spinbutton']", "[role='switch']", "[role='tab']",
  ].join(",");
  let backgroundPanEnabled = false;
  let panPointerId = null;
  let panTarget = null;
  let lastPoint = { clientX: 0, clientY: 0 };
  const contentOwnsPointer = (target) => target instanceof Element && Boolean(target.closest(interactiveSelector));
  const canScrollToward = (target, deltaX, deltaY) => {
    const vertical = Math.abs(deltaY) >= Math.abs(deltaX);
    const delta = vertical ? deltaY : deltaX;
    if (delta === 0) return false;
    const root = document.scrollingElement;
    for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const overflow = vertical ? style.overflowY : style.overflowX;
      const viewport = vertical ? node.clientHeight : node.clientWidth;
      const extent = vertical ? node.scrollHeight : node.scrollWidth;
      const position = vertical ? node.scrollTop : node.scrollLeft;
      const scrollable = (node === root || /^(auto|scroll|overlay)$/.test(overflow)) && extent > viewport + 1;
      if (scrollable && (delta < 0 ? position > 0.5 : position < extent - viewport - 0.5)) return true;
    }
    return false;
  };
  const postPan = (phase, point = lastPoint) => window.parent.postMessage({
    type: "tafelraum:interactive-pan",
    phase,
    pointerId: panPointerId,
    clientX: point.clientX,
    clientY: point.clientY,
  }, "*");
  const finishPan = (phase, event) => {
    if (panPointerId === null || (event && event.pointerId !== panPointerId)) return;
    if (event) {
      lastPoint = { clientX: event.clientX, clientY: event.clientY };
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    postPan(phase);
    if (panTarget?.hasPointerCapture?.(panPointerId)) panTarget.releasePointerCapture(panPointerId);
    panPointerId = null;
    panTarget = null;
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "tafelraum:interactive-pan-mode") return;
    backgroundPanEnabled = event.data.enabled === true;
    if (!backgroundPanEnabled) finishPan("cancel");
  });
  window.addEventListener("pointerdown", (event) => {
    if (!backgroundPanEnabled || panPointerId !== null || !event.isPrimary || event.button !== 0 || contentOwnsPointer(event.target)) return;
    panPointerId = event.pointerId;
    panTarget = event.target instanceof Element ? event.target : document.documentElement;
    lastPoint = { clientX: event.clientX, clientY: event.clientY };
    panTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
    postPan("start");
  }, { capture: true });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== panPointerId) return;
    lastPoint = { clientX: event.clientX, clientY: event.clientY };
    event.preventDefault();
    event.stopImmediatePropagation();
    postPan("move");
  }, { capture: true });
  window.addEventListener("pointerup", (event) => finishPan("end", event), { capture: true });
  window.addEventListener("pointercancel", (event) => finishPan("cancel", event), { capture: true });
  window.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      window.parent.postMessage({
        type: "tafelraum:interactive-zoom",
        clientX: event.clientX,
        clientY: event.clientY,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      }, "*");
      return;
    }
    if (canScrollToward(event.target, event.deltaX, event.deltaY)) return;
    event.preventDefault();
    window.parent.postMessage({
      type: "tafelraum:interactive-wheel-pan",
      clientX: event.clientX,
      clientY: event.clientY,
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      shiftKey: event.shiftKey,
    }, "*");
  }, { capture: true, passive: false });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".set-card-visual")) {
      closeEditorVisualPopovers();
    }
  });
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
  elements.printCloseButton.addEventListener("click", closePrintOverlay);
  elements.printBackButton.addEventListener("click", showPrintModeChoice);
  elements.printDirectionSelect.addEventListener("change", () => {
    state.printDirection = elements.printDirectionSelect.value;
    updatePrintDirection();
  });
  elements.printSwapDirection.addEventListener("click", swapPrintDirection);
  elements.printDownloadButton.addEventListener("click", () => { void downloadPrintPdf(); });
  elements.deleteSetCancel.addEventListener("click", closeDeleteSetDialog);
  elements.deleteSetConfirm.addEventListener("click", handleDeleteSet);
  elements.createSetButton.addEventListener("click", openNewSetEditor);
  elements.setEditorClose.addEventListener("click", () => {
    void closeSetEditor();
  });
  elements.setEditorCancel.addEventListener("click", () => {
    void closeSetEditor();
  });
  elements.setEditorChooseManual.addEventListener("click", openManualSetEditor);
  elements.setEditorChooseImport.addEventListener("click", openInitialSetImport);
  elements.setOpenImportButton.addEventListener("click", openAppendSetImport);
  elements.setImportBack.addEventListener("click", returnFromSetImport);
  elements.setEditorForm.addEventListener("submit", handleSaveSet);
  elements.setEditorForm.addEventListener("input", scheduleEditorDraftSave);
  elements.addCardButton.addEventListener("click", () => addEditorCard());
  elements.generateVisualsButton.addEventListener("click", handleGenerateMissingVisuals);
  elements.regenerateAllVisualsButton.addEventListener("click", handleRegenerateAllVisuals);
  elements.setImportFilePicker.addEventListener("click", () => elements.setImportFiles.click());
  elements.setImportFiles.addEventListener("change", () => {
    setEditorFiles(Array.from(elements.setImportFiles.files || []), { append: true });
    elements.setImportFiles.value = "";
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
    setEditorFiles(Array.from(event.dataTransfer?.files || []), { append: true });
  });

  for (const trigger of elements.closeShareTriggers) {
    trigger.addEventListener("click", closeShareOverlay);
  }

  for (const trigger of elements.closePrintTriggers) {
    trigger.addEventListener("click", closePrintOverlay);
  }

  for (const button of elements.printModeButtons) {
    button.addEventListener("click", () => selectPrintKind(button.dataset.printKind));
  }

  for (const trigger of elements.closeDeleteSetTriggers) {
    trigger.addEventListener("click", closeDeleteSetDialog);
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
      if (!elements.printOverlay.hidden) {
        closePrintOverlay();
        return;
      }

      if (!elements.passwordOverlay.hidden) {
        closePasswordDialog();
        return;
      }

      if (!elements.settingsMenu.hidden) {
        closeTeacherSettingsMenu();
        return;
      }

      if (!elements.deleteSetOverlay.hidden) {
        closeDeleteSetDialog();
        return;
      }

      if (!elements.shareOverlay.hidden) {
        closeShareOverlay();
        return;
      }

      if (!elements.setEditorOverlay.hidden) {
        void closeSetEditor();
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
  state.visualConfigured = Boolean(response.data?.visualConfigured);
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
  const [sets, tablets, visualJobs] = await Promise.all([
    loadSetIndex(),
    loadTabletDirectory(),
    loadVisualJobs(),
  ]);

  state.sets = sets;
  state.tablets = tablets;
  state.visualJobs = visualJobs;
  renderSetList();
  renderTabletList();
  scheduleVisualJobPolling();
}

async function loadVisualJobs() {
  const response = await requestJson("/api/teacher/visual-jobs", { auth: "teacher" });
  if (!response.ok) {
    throw createTeacherRequestError(response, "Bildstatus konnte nicht geladen werden.");
  }
  return Array.isArray(response.data?.jobs) ? response.data.jobs.map(normalizeVisualJob).filter(Boolean) : [];
}

function normalizeVisualJob(job) {
  const id = typeof job?.id === "string" ? job.id.trim() : "";
  const setId = typeof job?.setId === "string" ? job.setId.trim() : "";
  if (!id || !setId) {
    return null;
  }
  return {
    id,
    setId,
    type: job.type === "single" ? "single" : "sheet",
    status: typeof job.status === "string" ? job.status : "failed",
    totalCards: Math.max(0, Math.trunc(Number(job.totalCards) || 0)),
    totalSheets: Math.max(0, Math.trunc(Number(job.totalSheets) || 0)),
    completedSheets: Math.max(0, Math.trunc(Number(job.completedSheets) || 0)),
    activeSheet: Math.max(0, Math.trunc(Number(job.activeSheet) || 0)),
    attachedCount: Math.max(0, Math.trunc(Number(job.attachedCount) || 0)),
    skippedCount: Math.max(0, Math.trunc(Number(job.skippedCount) || 0)),
    error: typeof job.error === "string" ? job.error.trim() : "",
    createdAt: typeof job.createdAt === "string" ? job.createdAt : "",
  };
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
  const status = entry?.status === "draft" ? "draft" : "published";
  const ownerTeacherId = typeof entry?.ownerTeacherId === "string" && entry.ownerTeacherId.trim()
    ? entry.ownerTeacherId.trim()
    : (state.currentTeacher?.id || "");
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
    status,
    editable: Boolean(entry?.editable),
    deletable: entry?.deletable === undefined
      ? Boolean(entry?.editable && ownerTeacherId === state.currentTeacher?.id)
      : Boolean(entry.deletable),
    ownerTeacherId,
    ownerDisplayName: typeof entry?.ownerDisplayName === "string" && entry.ownerDisplayName.trim()
      ? entry.ownerDisplayName.trim()
      : ownerTeacherId,
    managedByAdmin: Boolean(entry?.managedByAdmin),
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
  const ownSets = state.sets.filter((setEntry) => setEntry.ownerTeacherId === state.currentTeacher?.id);
  const otherSets = state.sets.filter((setEntry) => setEntry.ownerTeacherId !== state.currentTeacher?.id);
  if (state.currentTeacher?.role === "admin") {
    elements.setsMeta.textContent = `${ownSets.length} eigene · ${otherSets.length} von anderen`;
  } else {
    elements.setsMeta.textContent = formatSetCount(ownSets.length);
  }

  appendSetCollection(elements.setList, ownSets);
  if (state.currentTeacher?.role === "admin" && otherSets.length > 0) {
    const managedSection = document.createElement("section");
    managedSection.className = "teacher-managed-sets";
    const heading = document.createElement("h3");
    heading.className = "teacher-managed-sets__title";
    heading.textContent = "Sets anderer Lehrkräfte";
    managedSection.append(heading);

    const groups = new Map();
    for (const setEntry of otherSets) {
      const owner = setEntry.ownerTeacherId;
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(setEntry);
    }
    for (const [ownerTeacherId, sets] of groups) {
      managedSection.append(createManagedOwnerGroup(ownerTeacherId, sets));
    }
    elements.setList.append(managedSection);
  }
}

function formatSetCount(count) {
  return `${count} Set${count === 1 ? "" : "s"}`;
}

function appendSetCollection(container, sets) {
  const drafts = sets.filter((setEntry) => setEntry.status === "draft");
  const publishedSets = sets.filter((setEntry) => setEntry.status !== "draft");
  if (drafts.length > 0) {
    container.append(createSetGroup(drafts, `Entwürfe (${drafts.length})`));
  }
  if (publishedSets.length > 0) {
    container.append(createSetGroup(publishedSets, drafts.length ? "Veröffentlichte Sets" : ""));
  }
}

function createManagedOwnerGroup(ownerTeacherId, sets) {
  const details = document.createElement("details");
  details.className = "teacher-managed-owner";
  details.dataset.ownerTeacherId = ownerTeacherId;
  details.open = readOpenAdminSetGroups().includes(ownerTeacherId);

  const summary = document.createElement("summary");
  summary.className = "teacher-managed-owner__summary";
  const name = document.createElement("strong");
  name.textContent = sets[0]?.ownerDisplayName || ownerTeacherId;
  const count = document.createElement("span");
  count.textContent = formatSetCount(sets.length);
  summary.append(name, count);

  const content = document.createElement("div");
  content.className = "teacher-managed-owner__content";
  appendSetCollection(content, sets);
  details.append(summary, content);
  details.addEventListener("toggle", () => storeOpenAdminSetGroup(ownerTeacherId, details.open));
  return details;
}

function readOpenAdminSetGroups() {
  try {
    const value = JSON.parse(window.localStorage.getItem(ADMIN_SET_GROUP_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch (_error) {
    return [];
  }
}

function storeOpenAdminSetGroup(ownerTeacherId, isOpen) {
  const owners = new Set(readOpenAdminSetGroups());
  if (isOpen) owners.add(ownerTeacherId);
  else owners.delete(ownerTeacherId);
  window.localStorage.setItem(ADMIN_SET_GROUP_STORAGE_KEY, JSON.stringify([...owners]));
}

function createSetGroup(sets, titleText = "") {
  const group = document.createElement("section");
  group.className = "teacher-set-group";
  if (titleText) {
    const title = document.createElement("h3");
    title.className = "teacher-set-group__title";
    title.textContent = titleText;
    group.append(title);
  }
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
  const previousTab = state.activeTab;
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
    if (isActive && previousTab !== state.activeTab) {
      window.LerndeckUiMotion.revealSurface(panel);
    }
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

  const titleLine = document.createElement("div");
  titleLine.className = "teacher-set-row__title-line";
  titleLine.append(title);
  if (setEntry.status === "draft") {
    const draftBadge = document.createElement("span");
    draftBadge.className = "set-draft-badge";
    draftBadge.textContent = "Entwurf";
    titleLine.append(draftBadge);
  }
  const visualJob = getLatestVisualJob(setEntry.id);
  if (isVisualJobActive(visualJob)) {
    const jobBadge = document.createElement("span");
    jobBadge.className = "teacher-set-row__visual-job";
    jobBadge.append(createVisualSpinner(), document.createTextNode(formatVisualJobProgress(visualJob)));
    titleLine.append(jobBadge);
  }

  const meta = document.createElement("p");
  meta.className = "teacher-set-row__meta";
  meta.textContent = [
    setEntry.subject,
    `${setEntry.cardCount} Vokabel${setEntry.cardCount === 1 ? "" : "n"}`,
    setEntry.description,
  ]
    .filter(Boolean)
    .join(" · ") || "Lernset";

  copy.append(titleLine, meta);
  if (setEntry.status !== "draft") {
    copy.append(createTabletUsageBlock(setEntry));
  }

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

  if (setEntry.status !== "draft") {
    const practiceAction = document.createElement("button");
    practiceAction.className = "teacher-set-row__practice";
    practiceAction.type = "button";
    practiceAction.setAttribute("aria-label", `Lernmodi für Set ${setEntry.title} öffnen`);
    practiceAction.title = "Lernmodi öffnen";
    practiceAction.append(createButtonIcon(TEACHER_PRACTICE_ICON_PATH));
    practiceAction.addEventListener("click", () => {
      window.location.assign(buildTeacherPracticeUrl(setEntry));
    });
    actions.append(practiceAction);

    const printAction = document.createElement("button");
    printAction.className = "teacher-set-row__print";
    printAction.type = "button";
    printAction.setAttribute("aria-label", `Set ${setEntry.title} ausdrucken`);
    printAction.title = "Ausdrucken";
    printAction.append(createButtonIcon(PRINT_ICON_PATH));
    printAction.addEventListener("click", () => {
      void openPrintOverlay(setEntry);
    });
    actions.append(printAction);

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
  }

  if (setEntry.deletable) {
    const deleteAction = document.createElement("button");
    deleteAction.className = "teacher-set-row__delete";
    deleteAction.type = "button";
    deleteAction.setAttribute("aria-label", `Set ${setEntry.title} löschen`);
    deleteAction.title = "Löschen";
    deleteAction.append(createButtonIcon(DELETE_ICON_PATH));
    deleteAction.addEventListener("click", () => {
      openDeleteSetDialog(setEntry);
    });
    actions.append(deleteAction);
  }

  row.append(copy, actions);
  return row;
}

function buildTeacherPracticeUrl(setEntry) {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("teacherPractice", setEntry.id);
  if (TAFELRAUM_EMBED) {
    url.searchParams.set("embed", "tafelraum");
  }
  return url.href;
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
  const shouldOpen = menu.hidden || menu.classList.contains("ui-motion-popover-leaving");
  closeTabletActionMenus();

  if (!shouldOpen) {
    return;
  }

  shell.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
  window.LerndeckUiMotion.revealPopover(menu);
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
      window.LerndeckUiMotion.hidePopover(menu);
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
  closePrintOverlay();
  closeDeleteSetDialog();
  closeSetEditor();
  closePasswordDialog();
  closeTeacherSettingsMenu();
  closeTabletActionMenus();
  state.authReady = false;
  state.currentTeacher = null;
  elements.authPanel.hidden = false;
  elements.shell.hidden = true;
  window.LerndeckUiMotion.revealSurface(elements.authPanel);
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
  window.LerndeckUiMotion.revealSurface(elements.shell);
  elements.authFeedback.textContent = "";
  const displayName = state.currentTeacher?.displayName || "Lehrkraft";
  elements.profileName.textContent = displayName;
  const isAdmin = state.currentTeacher?.role === "admin";
  elements.profileRole.hidden = !isAdmin;
  elements.accountStatus.setAttribute("aria-label", `Angemeldet als ${displayName}${isAdmin ? ", Admin" : ""}`);
  closeTeacherSettingsMenu();
  closeTabletActionMenus();
}

function toggleTeacherSettingsMenu() {
  const shouldOpen = elements.settingsMenu.hidden
    || elements.settingsMenu.classList.contains("ui-motion-popover-leaving");
  elements.settingsButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  if (shouldOpen) {
    window.LerndeckUiMotion.revealPopover(elements.settingsMenu);
    requestAnimationFrame(() => elements.changePasswordMenuButton.focus());
  } else {
    window.LerndeckUiMotion.hidePopover(elements.settingsMenu);
  }
}

function closeTeacherSettingsMenu() {
  window.LerndeckUiMotion.hidePopover(elements.settingsMenu);
  elements.settingsButton.setAttribute("aria-expanded", "false");
}

function syncTeacherModalLock() {
  const hasOpenModal = [
    elements.passwordOverlay,
    elements.shareOverlay,
    elements.printOverlay,
    elements.deleteSetOverlay,
    elements.setEditorOverlay,
  ].some((overlay) => !overlay.hidden);
  document.body.classList.toggle("has-modal-open", hasOpenModal);
}

function openPasswordDialog() {
  closeTeacherSettingsMenu();
  elements.passwordForm.reset();
  elements.passwordFeedback.textContent = "";
  window.LerndeckUiMotion.show(elements.passwordOverlay, { focus: elements.currentPasswordInput });
  syncTeacherModalLock();
}

function closePasswordDialog() {
  window.LerndeckUiMotion.hide(elements.passwordOverlay, {
    after: () => {
      elements.passwordForm.reset();
      elements.passwordFeedback.textContent = "";
      syncTeacherModalLock();
    },
  });
}

async function openShareOverlay(setEntry) {
  state.activeSet = setEntry;
  state.activeShareUrl = buildStudentShareUrl(setEntry);
  elements.shareTitle.textContent = setEntry.title;
  elements.shareCode.textContent = setEntry.shareCode || "";
  elements.sharePath.hidden = !setEntry.shareCode;
  elements.shareLink.value = state.activeShareUrl;
  elements.shareFeedback.textContent = "";
  window.LerndeckUiMotion.show(elements.shareOverlay);
  syncTeacherModalLock();

  try {
    await renderShareQr(state.activeShareUrl);
  } catch (error) {
    console.error("Unable to render QR code:", error);
    elements.shareFeedback.textContent = "QR-Code fehlt.";
    clearQrCanvas();
  }
}

function closeShareOverlay() {
  window.LerndeckUiMotion.hide(elements.shareOverlay, {
    after: () => {
      elements.sharePath.hidden = true;
      elements.shareFeedback.textContent = "";
      syncTeacherModalLock();
    },
  });
}

async function openPrintOverlay(setEntry) {
  resetPrintState();
  elements.printTitle.textContent = setEntry.title;
  elements.printModeFeedback.textContent = "Set wird geladen …";
  elements.printModeView.hidden = false;
  elements.printWorkspace.hidden = true;
  for (const button of elements.printModeButtons) {
    button.disabled = true;
  }
  window.LerndeckUiMotion.show(elements.printOverlay);
  syncTeacherModalLock();
  const requestId = ++state.printPreviewRequestId;

  try {
    const response = await requestJson(`/api/teacher/sets/${encodeURIComponent(setEntry.id)}`, {
      auth: "teacher",
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Set konnte nicht geladen werden.");
    }
    if (requestId !== state.printPreviewRequestId || elements.printOverlay.hidden) {
      return;
    }

    state.printSet = response.data?.set || null;
    if (!state.printSet || !Array.isArray(state.printSet.cards) || state.printSet.cards.length === 0) {
      throw new Error("Dieses Set enthält keine druckbaren Vokabeln.");
    }
    elements.printTitle.textContent = state.printSet.title || setEntry.title;
    configurePrintDirectionOptions();
    elements.printModeFeedback.textContent = "";
    for (const button of elements.printModeButtons) {
      button.disabled = false;
    }
  } catch (error) {
    if (requestId !== state.printPreviewRequestId) {
      return;
    }
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    elements.printModeFeedback.textContent = error.message || "Set konnte nicht geladen werden.";
  }
}

function closePrintOverlay() {
  if (state.printPreviewTimerId !== null) {
    window.clearTimeout(state.printPreviewTimerId);
    state.printPreviewTimerId = null;
  }
  state.printPreviewRequestId += 1;
  state.printPreviewAbortController?.abort();
  state.printPreviewAbortController = null;
  window.LerndeckUiMotion.hide(elements.printOverlay, {
    after: () => {
      resetPrintState();
      syncTeacherModalLock();
    },
  });
}

function resetPrintState() {
  if (state.printPdfUrl) {
    URL.revokeObjectURL(state.printPdfUrl);
  }
  state.printSet = null;
  state.printKind = "";
  state.printDirection = "source-target";
  state.printSelectedCardIds = [];
  state.printPdfUrl = "";
  state.printTestDraft = null;
  elements.printCardList.replaceChildren();
  elements.printPaper.replaceChildren();
  elements.printPaper.hidden = true;
  elements.printModeFeedback.textContent = "";
  elements.printFeedback.textContent = "";
  elements.printPreview.removeAttribute("src");
  elements.printPreview.hidden = true;
  elements.printPreviewLoading.hidden = false;
  elements.printDownloadButton.disabled = true;
}

function showPrintModeChoice() {
  state.printKind = "";
  clearPrintPreview();
  elements.printWorkspace.hidden = true;
  elements.printModeView.hidden = false;
  elements.printFeedback.textContent = "";
  requestAnimationFrame(() => elements.printModeButtons[0]?.focus());
}

function selectPrintKind(kind) {
  if (!state.printSet || (kind !== "list" && kind !== "test")) {
    return;
  }
  state.printKind = kind;
  state.printSelectedCardIds = kind === "list"
    ? state.printSet.cards.map((card) => String(card.id))
    : state.printSet.cards.slice(0, 10).map((card) => String(card.id));
  state.printTestDraft = kind === "test" ? {
    title: state.printSet.title || "",
    className: "",
    instruction: "Übersetze die folgenden Begriffe in die jeweils korrekte Sprache. Formuliere vollständig und achte auf saubere Schrift.",
    items: new Map(),
  } : null;
  if (kind === "test") {
    for (const cardId of state.printSelectedCardIds) {
      state.printTestDraft.items.set(cardId, createPrintTestItem(cardId));
    }
  }
  elements.printModeView.hidden = true;
  elements.printWorkspace.hidden = false;
  elements.printConfig.hidden = kind === "list";
  elements.printLayout.classList.toggle("print-layout--list", kind === "list");
  elements.printPaper.hidden = kind !== "test";
  elements.printPreview.hidden = kind === "test";
  elements.printPreviewLoading.hidden = kind === "test";
  renderPrintCardList();
  if (kind === "test") {
    renderPrintPaper();
  } else {
    schedulePrintPreview(0);
  }
}

function configurePrintDirectionOptions() {
  const { sourceLabel, targetLabel } = getPrintSideLabels();
  elements.printDirectionSelect.replaceChildren(
    new Option(`${sourceLabel} → ${targetLabel}`, "source-target"),
    new Option(`${targetLabel} → ${sourceLabel}`, "target-source"),
  );
  elements.printDirectionSelect.value = state.printDirection;
}

function swapPrintDirection() {
  state.printDirection = state.printDirection === "source-target"
    ? "target-source"
    : "source-target";
  elements.printDirectionSelect.value = state.printDirection;
  updatePrintDirection();
}

function updatePrintDirection() {
  if (state.printKind === "test") {
    for (const cardId of state.printSelectedCardIds) {
      const item = state.printTestDraft.items.get(cardId);
      if (item && !item.edited) {
        item.side = state.printDirection;
        item.prompt = getPrintCardPrompt(cardId, item.side);
      }
    }
    renderPrintCardList();
    renderPrintPaper();
  } else {
    schedulePrintPreview();
  }
}

function getPrintSideLabels() {
  return {
    sourceLabel: String(state.printSet?.sourceLabel || "Vorderseite").trim() || "Vorderseite",
    targetLabel: String(state.printSet?.targetLabel || "Rückseite").trim() || "Rückseite",
  };
}

function renderPrintCardList() {
  if (state.printKind !== "test" || !state.printSet) {
    elements.printCardList.replaceChildren();
    return;
  }
  elements.printCardList.replaceChildren();
  elements.printSelectionCount.textContent = `${state.printSelectedCardIds.length} ausgewählt`;
  for (const card of state.printSet.cards) {
    const cardId = String(card.id);
    const isSelected = state.printSelectedCardIds.includes(cardId);
    const row = document.createElement("article");
    row.className = "print-card-row";
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("role", "listitem");
    row.dataset.cardId = cardId;

    const toggle = document.createElement("button");
    toggle.className = "print-card-row__toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", isSelected ? "true" : "false");
    toggle.setAttribute("aria-label", `${card.front} ${isSelected ? "aus Test entfernen" : "zum Test hinzufügen"}`);

    const position = document.createElement("span");
    position.className = "print-card-row__position";
    position.textContent = isSelected ? "✓" : "+";
    position.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "print-card-row__copy";
    const prompt = document.createElement("strong");
    prompt.textContent = card.front;
    const answer = document.createElement("small");
    answer.textContent = card.back;
    copy.append(prompt, answer);
    toggle.append(position, copy);
    toggle.addEventListener("click", () => togglePrintCard(cardId));
    row.append(toggle);

    elements.printCardList.append(row);
  }
}

function createPrintOrderButton(label, accessibleLabel, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute("aria-label", accessibleLabel);
  button.addEventListener("click", onClick);
  return button;
}

function togglePrintCard(cardId) {
  const index = state.printSelectedCardIds.indexOf(cardId);
  if (index === -1) {
    state.printSelectedCardIds.push(cardId);
    state.printTestDraft.items.set(cardId, createPrintTestItem(cardId));
  } else {
    state.printSelectedCardIds.splice(index, 1);
    state.printTestDraft.items.delete(cardId);
  }
  renderPrintCardList();
  renderPrintPaper();
}

function moveSelectedPrintCard(cardId, offset) {
  const fromIndex = state.printSelectedCardIds.indexOf(cardId);
  const toIndex = fromIndex + offset;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= state.printSelectedCardIds.length) return;
  state.printSelectedCardIds.splice(fromIndex, 1);
  state.printSelectedCardIds.splice(toIndex, 0, cardId);
  renderPrintPaper();
}

function getPrintCardPrompt(cardId, direction) {
  const card = state.printSet.cards.find((entry) => String(entry.id) === cardId);
  return direction === "source-target" ? card.front : card.back;
}

function createPrintTestItem(cardId) {
  return { side: state.printDirection, prompt: getPrintCardPrompt(cardId, state.printDirection), edited: false };
}

function createPrintPaperField({ value, label, maxLength, placeholder = "", multiline = false, onInput }) {
  const field = document.createElement(multiline ? "textarea" : "input");
  field.className = "print-paper__field";
  field.setAttribute("aria-label", label);
  field.maxLength = maxLength;
  field.value = value;
  field.placeholder = placeholder;
  if (multiline) {
    field.rows = 1;
    field.addEventListener("input", () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    });
    requestAnimationFrame(() => {
      field.style.height = `${field.scrollHeight}px`;
    });
  }
  field.addEventListener("input", () => onInput(field.value));
  return field;
}

function renderPrintPaper() {
  if (state.printKind !== "test" || !state.printTestDraft) return;
  const draft = state.printTestDraft;
  const paper = elements.printPaper;
  paper.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "print-paper__eyebrow";
  heading.textContent = "VOKABELTEST";
  const header = document.createElement("div");
  header.className = "print-paper__header";
  const metadata = document.createElement("div");
  metadata.className = "print-paper__metadata";
  const classLine = document.createElement("label");
  classLine.className = "print-paper__class";
  classLine.append("Klasse: ", createPrintPaperField({
    value: draft.className, label: "Klasse auf dem Blatt", maxLength: 80, placeholder: "__________",
    onInput: (value) => { draft.className = value; },
  }));
  const title = createPrintPaperField({
    value: draft.title, label: "Titel auf dem Blatt", maxLength: 160,
    onInput: (value) => { draft.title = value; },
  });
  title.classList.add("print-paper__title");
  metadata.append(classLine, title);
  const identity = document.createElement("div");
  identity.className = "print-paper__identity";
  identity.innerHTML = '<span>Name: <i></i></span><span>Datum: <i></i></span>';
  header.append(metadata, identity);
  const instruction = document.createElement("div");
  instruction.className = "print-paper__instruction";
  const instructionLabel = document.createElement("span");
  instructionLabel.textContent = "ARBEITSAUFTRAG";
  instruction.append(instructionLabel, createPrintPaperField({
    value: draft.instruction, label: "Arbeitsauftrag auf dem Blatt", maxLength: 240, multiline: true,
    onInput: (value) => { draft.instruction = value; },
  }));
  const columns = document.createElement("div");
  columns.className = "print-paper__columns";
  columns.innerHTML = '<span>BEGRIFF</span><span>ANTWORT</span>';
  const rows = document.createElement("div");
  rows.className = "print-paper__rows";
  state.printSelectedCardIds.forEach((cardId, index) => {
    const item = draft.items.get(cardId);
    const row = document.createElement("div");
    row.className = "print-paper__row";
    row.dataset.cardId = cardId;
    const handle = document.createElement("button");
    handle.className = "print-paper__handle";
    handle.type = "button";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-label", `Begriff ${index + 1} verschieben; mit Pfeiltasten nach oben oder unten`);
    handle.title = "Ziehen oder mit Pfeiltasten verschieben";
    bindPrintRowDragHandle(handle, row, cardId);
    const number = document.createElement("span");
    number.className = "print-paper__number";
    number.textContent = `${index + 1}.`;
    const prompt = createPrintPaperField({
      value: item.prompt, label: `Begriff ${index + 1} auf dem Blatt`, maxLength: 500, multiline: true,
      onInput: (value) => { item.prompt = value; item.edited = true; updatePrintTestValidity(); },
    });
    prompt.classList.add("print-paper__prompt");
    const answerLine = document.createElement("span");
    answerLine.className = "print-paper__answer-line";
    const actions = document.createElement("span");
    actions.className = "print-paper__row-actions";
    const swap = createPrintOrderButton("⇄", `Begriff ${index + 1}: Anzeigeseite tauschen`, false, () => {
      item.side = item.side === "source-target" ? "target-source" : "source-target";
      item.prompt = getPrintCardPrompt(cardId, item.side);
      item.edited = false;
      renderPrintPaper();
    });
    const remove = createPrintOrderButton("×", `Begriff ${index + 1} entfernen`, false, () => togglePrintCard(cardId));
    actions.append(swap, remove);
    row.append(handle, number, prompt, answerLine, actions);
    rows.append(row);
  });
  if (state.printSelectedCardIds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "print-paper__empty";
    empty.textContent = "Links eine Vokabel anklicken, um sie hier einzufügen.";
    rows.append(empty);
  }
  const score = document.createElement("div");
  score.className = "print-paper__score";
  score.innerHTML = '<span>Punkte: <i></i></span><span>Prozent: <i></i></span><span>Note: <i></i></span>';
  paper.append(heading, header, instruction, columns, rows, score);
  updatePrintTestValidity();
}

function bindPrintRowDragHandle(handle, row, cardId) {
  let targetId = "";
  const clearTarget = () => {
    elements.printPaper.querySelector(".print-paper__row.is-drop-target")?.classList.remove("is-drop-target");
    row.classList.remove("is-dragging");
    targetId = "";
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    row.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    const preview = elements.printPaper.parentElement;
    const bounds = preview.getBoundingClientRect();
    if (event.clientY > bounds.bottom - 32) preview.scrollTop += 16;
    else if (event.clientY < bounds.top + 32) preview.scrollTop -= 16;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".print-paper__row");
    const nextId = target?.dataset.cardId !== cardId ? target?.dataset.cardId || "" : "";
    if (nextId === targetId) return;
    elements.printPaper.querySelector(".print-paper__row.is-drop-target")?.classList.remove("is-drop-target");
    targetId = nextId;
    if (targetId) target.classList.add("is-drop-target");
  });
  handle.addEventListener("pointerup", () => {
    const droppedOn = targetId;
    clearTarget();
    if (droppedOn) reorderSelectedPrintCard(cardId, droppedOn);
  });
  handle.addEventListener("pointercancel", clearTarget);
  handle.addEventListener("keydown", (event) => {
    const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!offset) return;
    event.preventDefault();
    moveSelectedPrintCard(cardId, offset);
    requestAnimationFrame(() => {
      [...elements.printPaper.querySelectorAll(".print-paper__row")]
        .find((candidate) => candidate.dataset.cardId === cardId)
        ?.querySelector(".print-paper__handle")?.focus();
    });
  });
}

function reorderSelectedPrintCard(draggedId, targetId) {
  const fromIndex = state.printSelectedCardIds.indexOf(draggedId);
  const toIndex = state.printSelectedCardIds.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  state.printSelectedCardIds.splice(fromIndex, 1);
  state.printSelectedCardIds.splice(toIndex, 0, draggedId);
  renderPrintPaper();
}

function updatePrintTestValidity() {
  const hasItems = state.printSelectedCardIds.length > 0;
  const hasEmptyPrompt = state.printSelectedCardIds.some((id) => !state.printTestDraft.items.get(id).prompt.trim());
  elements.printDownloadButton.disabled = !hasItems || hasEmptyPrompt;
  elements.printFeedback.textContent = !hasItems ? "Wähle mindestens eine Vokabel aus."
    : hasEmptyPrompt ? "Bitte leere Begriffe auf dem Blatt ausfüllen." : "";
}

function schedulePrintPreview(delay = 280) {
  if (state.printKind !== "list") return;
  if (state.printPreviewTimerId !== null) {
    window.clearTimeout(state.printPreviewTimerId);
  }
  state.printPreviewTimerId = window.setTimeout(() => {
    state.printPreviewTimerId = null;
    void refreshPrintPreview();
  }, delay);
}

async function refreshPrintPreview() {
  if (!state.printSet || !state.printKind) return;
  if (state.printSelectedCardIds.length === 0) {
    clearPrintPreview();
    elements.printFeedback.textContent = "Wähle mindestens eine Vokabel aus.";
    elements.printPreviewLoading.textContent = "Keine Vokabel ausgewählt";
    elements.printPreviewLoading.hidden = false;
    return;
  }

  state.printPreviewAbortController?.abort();
  const abortController = new AbortController();
  state.printPreviewAbortController = abortController;
  const requestId = ++state.printPreviewRequestId;
  clearPrintPreview({ keepRequest: true });
  elements.printFeedback.textContent = "";
  elements.printPreviewLoading.textContent = "Vorschau wird erstellt …";
  elements.printPreviewLoading.hidden = false;

  try {
    const blob = await requestPrintPdf(abortController.signal);
    if (requestId !== state.printPreviewRequestId || abortController.signal.aborted) return;
    state.printPdfUrl = URL.createObjectURL(blob);
    elements.printPreview.src = state.printPdfUrl;
    elements.printPreview.hidden = false;
    elements.printPreviewLoading.hidden = true;
    elements.printDownloadButton.disabled = false;
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== state.printPreviewRequestId) return;
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    elements.printFeedback.textContent = error.message || "PDF konnte nicht erstellt werden.";
    elements.printPreviewLoading.textContent = "Vorschau nicht verfügbar";
    elements.printPreviewLoading.hidden = false;
  } finally {
    if (state.printPreviewAbortController === abortController) {
      state.printPreviewAbortController = null;
    }
  }
}

function buildPrintRequestBody() {
  const testDraft = state.printTestDraft;
  return {
    kind: state.printKind,
    direction: state.printDirection,
    cardIds: [...state.printSelectedCardIds],
    ...(state.printKind === "test" ? { testDraft: {
      title: testDraft.title,
      className: testDraft.className,
      instruction: testDraft.instruction,
      items: state.printSelectedCardIds.map((id) => ({ id, prompt: testDraft.items.get(id).prompt })),
    } } : {}),
  };
}

async function requestPrintPdf(signal, body = buildPrintRequestBody()) {
  const headers = { "Content-Type": "application/json" };
  if (TAFELRAUM_EMBED) headers["X-Lerndeck-Embed"] = "tafelraum";
  const response = await fetch(`/api/teacher/sets/${encodeURIComponent(state.printSet.id)}/print`, {
    method: "POST",
    headers,
    credentials: "same-origin",
    signal,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || "PDF konnte nicht erstellt werden.");
    error.requiresAuth = response.status === 401 || response.status === 403;
    throw error;
  }
  return response.blob();
}

function clearPrintPreview({ keepRequest = false } = {}) {
  if (!keepRequest) state.printPreviewRequestId += 1;
  if (state.printPdfUrl) URL.revokeObjectURL(state.printPdfUrl);
  state.printPdfUrl = "";
  elements.printPreview.removeAttribute("src");
  elements.printPreview.hidden = true;
  elements.printDownloadButton.disabled = true;
}

async function downloadPrintPdf() {
  if (!state.printSet || !state.printKind || state.printSelectedCardIds.length === 0) return;
  let downloadUrl = state.printPdfUrl;
  if (state.printKind === "test") {
    elements.printDownloadButton.disabled = true;
    elements.printFeedback.textContent = "PDF wird erstellt …";
    try {
      const body = buildPrintRequestBody();
      const blob = await requestPrintPdf(undefined, body);
      if (state.printKind !== "test" || elements.printOverlay.hidden) return;
      if (JSON.stringify(buildPrintRequestBody()) !== JSON.stringify(body)) {
        elements.printFeedback.textContent = "Das Blatt wurde während der PDF-Erstellung geändert. Bitte erneut herunterladen.";
        return;
      }
      downloadUrl = URL.createObjectURL(blob);
      elements.printFeedback.textContent = "";
    } catch (error) {
      if (error?.requiresAuth) showTeacherAuth(error.message);
      else elements.printFeedback.textContent = error.message || "PDF konnte nicht erstellt werden.";
      return;
    } finally {
      if (state.printKind === "test" && state.printTestDraft) {
        elements.printDownloadButton.disabled = state.printSelectedCardIds.length === 0
          || state.printSelectedCardIds.some((id) => !state.printTestDraft.items.get(id).prompt.trim());
      }
    }
  }
  if (!downloadUrl) return;
  const titleSlug = String((state.printKind === "test" ? state.printTestDraft?.title : "") || state.printSet.title || "lernset")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lernset";
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${state.printKind === "test" ? "vokabeltest" : "vokabelliste"}-${titleSlug}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  if (state.printKind === "test") window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
}

function openDeleteSetDialog(setEntry) {
  state.pendingDeleteSet = setEntry;
  elements.deleteSetCopy.textContent = `„${setEntry.title}“ wirklich löschen?`;
  elements.deleteSetFeedback.textContent = "";
  elements.deleteSetCancel.disabled = false;
  elements.deleteSetConfirm.disabled = false;
  window.LerndeckUiMotion.show(elements.deleteSetOverlay, { focus: elements.deleteSetCancel });
  syncTeacherModalLock();
}

function closeDeleteSetDialog() {
  window.LerndeckUiMotion.hide(elements.deleteSetOverlay, {
    after: () => {
      elements.deleteSetFeedback.textContent = "";
      elements.deleteSetCancel.disabled = false;
      elements.deleteSetConfirm.disabled = false;
      syncTeacherModalLock();
    },
  });
  state.pendingDeleteSet = null;
}

async function handleDeleteSet() {
  const setEntry = state.pendingDeleteSet;
  if (!setEntry) {
    return;
  }

  elements.deleteSetCancel.disabled = true;
  elements.deleteSetConfirm.disabled = true;
  elements.deleteSetFeedback.textContent = "Wird gelöscht …";

  try {
    const response = await requestJson(`/api/teacher/sets/${encodeURIComponent(setEntry.id)}`, {
      method: "DELETE",
      auth: "teacher",
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Set konnte nicht gelöscht werden.");
    }

    state.sets = state.sets.filter((entry) => entry.id !== setEntry.id);
    renderSetList();
    closeDeleteSetDialog();
    try {
      await reloadTeacherData();
    } catch (reloadError) {
      console.error("Unable to refresh sets after deletion:", reloadError);
    }
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    console.error("Unable to delete set:", error);
    elements.deleteSetFeedback.textContent = error.message || "Set konnte nicht gelöscht werden.";
    elements.deleteSetCancel.disabled = false;
    elements.deleteSetConfirm.disabled = false;
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
  resetEditorDraftState({ status: "draft" });
  state.editorSetId = "";
  state.editorCards = [];
  state.visualAssetsByCard = {};
  state.editorMetadata = { sourceLanguage: "", targetLanguage: "" };
  state.editorSideSelection = { front: "", back: "" };
  elements.setEditorTitle.textContent = "Neues Set";
  updateEditorStatusUi();
  elements.setTitleInput.value = "";
  elements.setSubjectInput.value = "";
  elements.setDescriptionInput.value = "";
  elements.setSourceLabelInput.value = "";
  elements.setTargetLabelInput.value = "";
  clearEditorSideError();
  elements.setEditorFeedback.textContent = "";
  resetSetImportInputs();
  window.LerndeckUiMotion.show(elements.setEditorOverlay);
  syncTeacherModalLock();
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
    resetEditorDraftState({ status: editableSet.status });
    state.editorSetId = editableSet.id;
    state.visualAssetsByCard = {};
    state.editorCards = Array.isArray(editableSet.cards)
      ? editableSet.cards.map(normalizeEditorCard).filter(Boolean)
      : [];
    restoreEditorSideSelection(editableSet);
    elements.setEditorTitle.textContent = editableSet.status === "draft" ? "Entwurf bearbeiten" : "Set bearbeiten";
    updateEditorStatusUi();
    elements.setTitleInput.value = editableSet.title || "";
    elements.setSubjectInput.value = editableSet.subject || "";
    elements.setDescriptionInput.value = editableSet.description || "";
    clearEditorSideError();
    elements.setEditorFeedback.textContent = "";
    resetSetImportInputs();
    if (state.editorCards.length === 0) {
      state.editorCards.push(createEmptyEditorCard());
    }
    renderEditorCards();
    window.LerndeckUiMotion.show(elements.setEditorOverlay);
    syncTeacherModalLock();
    showSetEditorView("manual");
    if (editableSet.status === "published") {
      await refreshEditorVisualWorkspace();
    }
  } catch (error) {
    if (error?.requiresAuth) {
      showTeacherAuth(error.message);
      return;
    }
    showTeacherActionError(error.message || "Set konnte nicht geladen werden.");
  }
}

async function closeSetEditor({ skipDraftSave = false } = {}) {
  if (!skipDraftSave && state.editorSetStatus === "draft") {
    const saved = await persistEditorDraft({ immediate: true });
    if (!saved) {
      return;
    }
  }
  window.LerndeckUiMotion.hide(elements.setEditorOverlay, {
    after: () => {
      elements.setEditorFeedback.textContent = "";
      resetSetImportInputs();
      syncTeacherModalLock();
    },
  });
  if (state.editorSetStatus === "draft" && state.editorSetId) {
    try {
      await reloadTeacherData();
    } catch (error) {
      console.error("Unable to refresh drafts:", error);
    }
  }
}

function resetEditorDraftState({ status = "draft" } = {}) {
  if (state.editorAutosaveTimerId) {
    window.clearTimeout(state.editorAutosaveTimerId);
  }
  state.editorSetStatus = status === "draft" ? "draft" : "published";
  state.editorDraftVersion = 0;
  state.editorSavedDraftVersion = 0;
  state.editorAutosaveTimerId = null;
  state.editorAutosavePromise = null;
}

function updateEditorStatusUi() {
  const isDraft = state.editorSetStatus === "draft";
  elements.setEditorStatus.hidden = !isDraft;
  elements.saveSetButton.textContent = isDraft ? "Set veröffentlichen" : "Änderungen speichern";
  renderVisualControls();
}

function showSetEditorView(view) {
  const nextView = ["choice", "manual", "import"].includes(view) ? view : "manual";
  state.editorView = nextView;
  elements.setEditorPanel.dataset.editorView = nextView;
  elements.setEditorChoice.hidden = nextView !== "choice";
  elements.setEditorForm.hidden = nextView !== "manual";
  elements.setImportSection.hidden = nextView !== "import";
  const activeView = nextView === "choice"
    ? elements.setEditorChoice
    : nextView === "import"
      ? elements.setImportSection
      : elements.setEditorForm;
  window.LerndeckUiMotion.revealSurface(activeView);

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
    visual: null,
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
    visual: normalizeEditorVisual(card.visual),
  };
}

function normalizeEditorVisual(visual) {
  const assetId = typeof visual?.assetId === "string" ? visual.assetId.trim() : "";
  const url = typeof visual?.url === "string" ? visual.url.trim() : "";
  if (!assetId || !url) {
    return null;
  }
  return {
    assetId,
    url,
    alt: typeof visual.alt === "string" ? visual.alt.trim() : "",
    width: Math.max(1, Math.trunc(Number(visual.width) || 512)),
    height: Math.max(1, Math.trunc(Number(visual.height) || 512)),
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
  elements.setCardCount.textContent = `${state.editorCards.length} Vokabel${state.editorCards.length === 1 ? "" : "n"}`;
  const sideLabels = getEditorCardSideLabels();

  const columns = document.createElement("div");
  columns.className = "set-card-editor-columns";
  const spacer = document.createElement("span");
  spacer.setAttribute("aria-hidden", "true");
  const imageLabel = document.createElement("span");
  imageLabel.className = "set-card-editor-columns__image";
  imageLabel.textContent = "Bild";
  const endSpacer = document.createElement("span");
  endSpacer.setAttribute("aria-hidden", "true");
  columns.append(spacer, createEditorSideSelect("front"), createEditorSideSelect("back"), imageLabel, endSpacer);
  elements.setCardList.append(columns);

  state.editorCards.forEach((card, index) => {
    const row = document.createElement("article");
    row.className = "set-card-editor-row";

    const number = document.createElement("span");
    number.className = "set-card-editor-row__number";
    number.textContent = String(index + 1);

    const front = createEditorInput(sideLabels.front, card.front, (value) => {
      card.front = value;
    }, { compact: true, side: "front" });
    const back = createEditorInput(sideLabels.back, card.back, (value) => {
      card.back = value;
    }, { compact: true, side: "back" });
    const visual = createEditorVisualControl(card, index);

    const remove = document.createElement("button");
    remove.className = "set-card-editor-row__remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Vokabel ${index + 1} entfernen`);
    remove.title = "Vokabel entfernen";
    remove.append(createButtonIcon(REMOVE_ICON_PATH));
    remove.addEventListener("click", () => {
      state.editorCards.splice(index, 1);
      if (state.editorCards.length === 0) {
        state.editorCards.push(createEmptyEditorCard());
      }
      renderEditorCards();
      scheduleEditorDraftSave();
    });

    row.append(number, front, back, visual, remove);
    elements.setCardList.append(row);
  });
  const addRow = document.createElement("button");
  addRow.className = "set-card-editor-add";
  addRow.type = "button";
  addRow.setAttribute("aria-label", "Neue Vokabel hinzufügen");
  const addIcon = document.createElement("span");
  addIcon.className = "set-card-editor-add__icon";
  addIcon.setAttribute("aria-hidden", "true");
  addIcon.textContent = "+";
  const addLabel = document.createElement("span");
  addLabel.className = "set-card-editor-add__label";
  addLabel.textContent = "Neue Vokabel hinzufügen";
  addRow.append(addIcon, addLabel);
  addRow.addEventListener("click", () => addEditorCard());
  elements.setCardList.append(addRow);
  renderVisualControls();
}

function createEditorSideSelect(side) {
  const field = document.createElement("label");
  field.className = "set-card-editor-columns__side";
  const title = document.createElement("span");
  title.textContent = side === "front" ? "Vorderseite *" : "Rückseite *";
  const select = document.createElement("select");
  select.dataset.editorSideSelect = side;
  select.required = true;
  const placeholder = new Option("Auswählen …", "");
  select.add(placeholder);
  if (side === "front") {
    for (const [groupLabel, keys] of [
      ["Sprachen", ["en", "de"]],
      ["Begriff und Definition", ["term", "definition"]],
      ["Frage und Antwort", ["question", "answer"]],
    ]) {
      const group = document.createElement("optgroup");
      group.label = groupLabel;
      for (const key of keys) {
        const choice = window.LerndeckSetSides.choices[key];
        group.append(new Option(`${choice.symbol}  ${choice.label}`, key));
      }
      select.append(group);
    }
  } else if (state.editorSideSelection.front) {
    const key = window.LerndeckSetSides.choices[state.editorSideSelection.front].partner;
    const choice = window.LerndeckSetSides.choices[key];
    select.add(new Option(`${choice.symbol}  ${choice.label}`, key));
  }
  select.value = state.editorSideSelection[side];
  select.disabled = side === "back" && !state.editorSideSelection.front;
  select.addEventListener("change", () => {
    state.editorSideSelection[side] = select.value;
    if (side === "front") {
      state.editorSideSelection.back = "";
    }
    applyEditorSideSelection();
    renderEditorCards();
    requestAnimationFrame(() => {
      if (side === "front") {
        elements.setCardList.querySelector('[data-editor-side-select="back"]')?.focus();
      } else {
        elements.setCardList.querySelector(".set-card-editor-row input")?.focus();
      }
    });
    scheduleEditorDraftSave();
  });
  field.append(title, select);
  return field;
}

function applyEditorSideSelection() {
  const configuration = window.LerndeckSetSides.resolve(
    state.editorSideSelection.front, state.editorSideSelection.back,
  );
  elements.setSourceLabelInput.value = configuration?.sourceLabel || "";
  elements.setTargetLabelInput.value = configuration?.targetLabel || "";
  state.editorMetadata = {
    sourceLanguage: configuration?.sourceLanguage || "",
    targetLanguage: configuration?.targetLanguage || "",
  };
  if (configuration) clearEditorSideError();
  updateEditorCardSideLabels();
}

function restoreEditorSideSelection(set) {
  const inferred = window.LerndeckSetSides.infer(set);
  const useExisting = set.status === "published" || Boolean(set.sidePreset);
  const selected = useExisting && inferred && (!set.sidePreset || inferred.preset === set.sidePreset)
    ? inferred : null;
  state.editorSideSelection = { front: selected?.front || "", back: selected?.back || "" };
  applyEditorSideSelection();
}

function clearEditorSideError() {
  elements.setSideFeedback.hidden = true;
  elements.setCardList.classList.remove("is-side-invalid");
}

function requireEditorSideSelection() {
  if (window.LerndeckSetSides.resolve(state.editorSideSelection.front, state.editorSideSelection.back)) return true;
  elements.setSideFeedback.hidden = false;
  elements.setCardList.classList.add("is-side-invalid");
  const missingSide = state.editorSideSelection.front ? "back" : "front";
  const select = elements.setCardList.querySelector(`[data-editor-side-select="${missingSide}"]`);
  select?.scrollIntoView({ behavior: "smooth", block: "center" });
  select?.focus({ preventScroll: true });
  return false;
}

function createEditorVisualControl(card, index) {
  const shell = document.createElement("div");
  shell.className = "set-card-visual";
  const history = Array.isArray(state.visualAssetsByCard[card.id]) ? state.visualAssetsByCard[card.id] : [];
  const activeAsset = card.visual
    ? history.find((asset) => asset.id === card.visual.assetId) || { id: card.visual.assetId, ...card.visual }
    : null;
  const trigger = document.createElement("button");
  trigger.className = "set-card-visual__trigger";
  trigger.type = "button";
  trigger.disabled = !card.id || state.editorSetStatus !== "published";
  trigger.setAttribute("aria-label", activeAsset ? `Bild zu Vokabel ${index + 1} ansehen` : `Bild zu Vokabel ${index + 1} erstellen`);
  trigger.setAttribute("aria-expanded", "false");
  if (activeAsset?.url) {
    const thumbnail = document.createElement("img");
    thumbnail.src = activeAsset.url;
    thumbnail.alt = "";
    thumbnail.loading = "lazy";
    trigger.classList.add("has-image");
    trigger.append(thumbnail);
  } else {
    trigger.append(createButtonIcon(IMAGE_PLUS_ICON_PATH));
  }
  trigger.addEventListener("click", () => {
    const nextOpen = !shell.classList.contains("is-open");
    closeEditorVisualPopovers(shell);
    shell.classList.toggle("is-open", nextOpen);
    trigger.setAttribute("aria-expanded", String(nextOpen));
  });
  shell.append(trigger);

  if (card.id && state.editorSetStatus === "published") {
    const popover = document.createElement("section");
    popover.className = "set-card-visual__popover";
    popover.setAttribute("aria-label", `Lernbild für Vokabel ${index + 1}`);
    if (activeAsset?.url) {
      const preview = document.createElement("img");
      preview.className = "set-card-visual__preview";
      preview.src = activeAsset.url;
      preview.alt = activeAsset.alt || `Lernbild zu ${card.front}`;
      popover.append(preview);
    } else {
      const empty = document.createElement("p");
      empty.className = "set-card-visual__empty";
      empty.textContent = "Noch kein Bild";
      popover.append(empty);
    }

    if (history.length > 1) {
      const historyRow = document.createElement("div");
      historyRow.className = "set-card-visual__history";
      history.slice(0, 5).forEach((asset) => {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "set-card-visual__history-choice";
        choice.classList.toggle("is-current", asset.id === card.visual?.assetId);
        choice.setAttribute("aria-label", asset.id === card.visual?.assetId ? "Aktuelles Bild" : "Dieses Bild verwenden");
        const image = document.createElement("img");
        image.src = asset.url;
        image.alt = "";
        image.loading = "lazy";
        choice.append(image);
        choice.addEventListener("click", () => void handleSelectVisualAsset(card, asset));
        historyRow.append(choice);
      });
      popover.append(historyRow);
    }

    const instructionLabel = document.createElement("label");
    instructionLabel.className = "set-card-visual__instruction";
    const instructionText = document.createElement("span");
    instructionText.textContent = "Bildwunsch (optional)";
    const instructionInput = document.createElement("textarea");
    instructionInput.rows = 2;
    instructionInput.maxLength = 300;
    instructionInput.value = activeAsset?.instruction || "";
    instructionInput.placeholder = "z. B. roter Bus von der Seite";
    instructionInput.setAttribute("aria-label", `Bildwunsch für Vokabel ${index + 1}`);
    instructionInput.addEventListener("click", (event) => event.stopPropagation());
    instructionLabel.append(instructionText, instructionInput);
    popover.append(instructionLabel);

    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.className = "set-card-visual__regenerate";
    regenerate.disabled = !state.visualConfigured || isVisualJobActive(getLatestVisualJob(state.editorSetId));
    regenerate.append(createButtonIcon(IMAGE_PLUS_ICON_PATH), document.createTextNode(activeAsset ? "Neu erstellen" : "Bild erstellen"));
    regenerate.addEventListener("click", () => void handleRegenerateCardVisual(card, instructionInput.value));
    popover.append(regenerate);
    shell.append(popover);
  }
  return shell;
}

function closeEditorVisualPopovers(except = null) {
  for (const shell of elements.setCardList.querySelectorAll(".set-card-visual.is-open")) {
    if (shell === except) {
      continue;
    }
    shell.classList.remove("is-open");
    shell.querySelector(".set-card-visual__trigger")?.setAttribute("aria-expanded", "false");
  }
}

function getLatestVisualJob(setId) {
  return state.visualJobs.find((job) => job.setId === setId) || null;
}

function isVisualJobActive(job) {
  return Boolean(job && ["queued", "generating", "applying"].includes(job.status));
}

function createVisualSpinner() {
  const spinner = document.createElement("span");
  spinner.className = "visual-job-spinner";
  spinner.setAttribute("aria-hidden", "true");
  return spinner;
}

function formatVisualJobProgress(job) {
  if (job?.type === "single") {
    return "Bild wird erstellt";
  }
  const sheet = Math.min(Math.max(job?.activeSheet || job?.completedSheets || 1, 1), Math.max(job?.totalSheets || 1, 1));
  return `Sheet ${sheet}/${Math.max(job?.totalSheets || 1, 1)}`;
}

function renderVisualControls() {
  if (!elements.generateVisualsButton || !elements.regenerateAllVisualsButton || !elements.visualJobStatus) {
    return;
  }
  const isPublished = state.editorSetStatus === "published" && Boolean(state.editorSetId);
  const job = isPublished ? getLatestVisualJob(state.editorSetId) : null;
  const active = isVisualJobActive(job);
  const missingCount = state.editorCards.filter((card) => card.id && !card.visual).length;
  const visualCount = state.editorCards.filter((card) => card.id && card.visual).length;
  const actionsAvailable = isPublished && !active;
  elements.generateVisualsButton.hidden = !actionsAvailable || missingCount === 0;
  elements.generateVisualsButton.disabled = !state.visualConfigured || active || missingCount === 0;
  elements.generateVisualsButton.querySelector("span").textContent = missingCount > 0
    ? `Bilder erstellen (${missingCount})`
    : "Bilder erstellt";
  elements.regenerateAllVisualsButton.hidden = !actionsAvailable || visualCount === 0;
  elements.regenerateAllVisualsButton.disabled = !state.visualConfigured || active;
  elements.regenerateAllVisualsButton.querySelector("span").textContent = "Alle Bilder neu";

  elements.visualJobStatus.replaceChildren();
  if (active) {
    elements.visualJobStatus.hidden = false;
    elements.visualJobStatus.className = "visual-job-status is-active";
    elements.visualJobStatus.append(
      createVisualSpinner(),
      document.createTextNode(`${formatVisualJobProgress(job)} · Du kannst weiterarbeiten.`),
    );
  } else if (job?.status === "failed") {
    elements.visualJobStatus.hidden = false;
    elements.visualJobStatus.className = "visual-job-status is-error";
    elements.visualJobStatus.textContent = job.error || "Bilder konnten nicht erstellt werden.";
  } else if (job?.status === "completed" && job.skippedCount > 0) {
    elements.visualJobStatus.hidden = false;
    elements.visualJobStatus.className = "visual-job-status";
    elements.visualJobStatus.textContent = `${job.attachedCount} Bilder zugeordnet · ${job.skippedCount} geänderte Vokabeln übersprungen.`;
  } else {
    elements.visualJobStatus.hidden = true;
  }
}

async function refreshEditorVisualWorkspace() {
  if (!state.editorSetId || state.editorSetStatus !== "published") {
    return;
  }
  try {
    const [workspaceResponse, setResponse] = await Promise.all([
      requestJson(`/api/teacher/sets/${encodeURIComponent(state.editorSetId)}/visual-assets`, { auth: "teacher" }),
      requestJson(`/api/teacher/sets/${encodeURIComponent(state.editorSetId)}`, { auth: "teacher" }),
    ]);
    if (!workspaceResponse.ok || !setResponse.ok) {
      throw createTeacherRequestError(
        !workspaceResponse.ok ? workspaceResponse : setResponse,
        "Bilder konnten nicht geladen werden.",
      );
    }
    const assetsByCard = {};
    for (const asset of Array.isArray(workspaceResponse.data?.assets) ? workspaceResponse.data.assets : []) {
      if (!asset?.cardId || !asset?.id || !asset?.url) {
        continue;
      }
      (assetsByCard[asset.cardId] ||= []).push(asset);
    }
    state.visualAssetsByCard = assetsByCard;
    const setJobs = Array.isArray(workspaceResponse.data?.jobs)
      ? workspaceResponse.data.jobs.map(normalizeVisualJob).filter(Boolean)
      : [];
    state.visualJobs = [
      ...setJobs,
      ...state.visualJobs.filter((job) => job.setId !== state.editorSetId),
    ];
    const serverCards = new Map((setResponse.data?.set?.cards || []).map((card) => [card.id, card]));
    for (const card of state.editorCards) {
      const serverCard = serverCards.get(card.id);
      card.visual = normalizeEditorVisual(serverCard?.visual);
    }
    renderEditorCards();
    scheduleVisualJobPolling();
  } catch (error) {
    console.error("Unable to refresh visual workspace:", error);
    renderVisualControls();
  }
}

async function handleGenerateMissingVisuals() {
  if (!state.editorSetId) {
    return;
  }
  elements.generateVisualsButton.disabled = true;
  try {
    const response = await requestJson(`/api/teacher/sets/${encodeURIComponent(state.editorSetId)}/visual-jobs`, {
      auth: "teacher",
      method: "POST",
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Bilderstellung konnte nicht gestartet werden.");
    }
    const job = normalizeVisualJob(response.data?.job);
    if (job) {
      state.visualJobs = [job, ...state.visualJobs.filter((entry) => entry.setId !== job.setId)];
    }
    renderVisualControls();
    renderSetList();
    scheduleVisualJobPolling();
  } catch (error) {
    elements.setEditorFeedback.textContent = error.message || "Bilderstellung konnte nicht gestartet werden.";
    renderVisualControls();
  }
}

async function handleRegenerateAllVisuals() {
  if (!state.editorSetId) {
    return;
  }
  const cardCount = state.editorCards.filter((card) => card.id).length;
  const confirmed = window.confirm(
    `Alle ${cardCount} Bilder dieses Sets fachlich neu planen und erstellen? Die bisherigen Varianten bleiben in der Bildauswahl erhalten.`,
  );
  if (!confirmed) {
    return;
  }
  elements.regenerateAllVisualsButton.disabled = true;
  try {
    const response = await requestJson(
      `/api/teacher/sets/${encodeURIComponent(state.editorSetId)}/visual-regenerations`,
      { auth: "teacher", method: "POST" },
    );
    if (!response.ok) {
      throw createTeacherRequestError(response, "Bilder konnten nicht neu erstellt werden.");
    }
    const job = normalizeVisualJob(response.data?.job);
    if (job) {
      state.visualJobs = [job, ...state.visualJobs.filter((entry) => entry.setId !== job.setId)];
    }
    renderVisualControls();
    renderEditorCards();
    scheduleVisualJobPolling();
  } catch (error) {
    elements.setEditorFeedback.textContent = error.message || "Bilder konnten nicht neu erstellt werden.";
    renderVisualControls();
  }
}

async function handleRegenerateCardVisual(card, instruction = "") {
  if (!state.editorSetId || !card?.id) {
    return;
  }
  try {
    const response = await requestJson(
      `/api/teacher/sets/${encodeURIComponent(state.editorSetId)}/cards/${encodeURIComponent(card.id)}/visual-regenerations`,
      { auth: "teacher", method: "POST", body: { instruction: instruction.trim() } },
    );
    if (!response.ok) {
      throw createTeacherRequestError(response, "Bild konnte nicht erstellt werden.");
    }
    const job = normalizeVisualJob(response.data?.job);
    if (job) {
      state.visualJobs = [job, ...state.visualJobs.filter((entry) => entry.setId !== job.setId)];
    }
    closeEditorVisualPopovers();
    renderEditorCards();
    scheduleVisualJobPolling();
  } catch (error) {
    elements.setEditorFeedback.textContent = error.message || "Bild konnte nicht erstellt werden.";
  }
}

async function handleSelectVisualAsset(card, asset) {
  try {
    const response = await requestJson(
      `/api/teacher/sets/${encodeURIComponent(state.editorSetId)}/cards/${encodeURIComponent(card.id)}/visual`,
      { auth: "teacher", method: "PUT", body: { assetId: asset.id } },
    );
    if (!response.ok) {
      throw createTeacherRequestError(response, "Bild konnte nicht ausgewählt werden.");
    }
    card.visual = normalizeEditorVisual({ assetId: asset.id, ...asset });
    renderEditorCards();
  } catch (error) {
    elements.setEditorFeedback.textContent = error.message || "Bild konnte nicht ausgewählt werden.";
  }
}

function scheduleVisualJobPolling() {
  if (state.visualPollTimerId) {
    window.clearTimeout(state.visualPollTimerId);
    state.visualPollTimerId = null;
  }
  if (!state.visualJobs.some(isVisualJobActive)) {
    return;
  }
  state.visualPollTimerId = window.setTimeout(() => void pollVisualJobs(), 1500);
}

async function pollVisualJobs() {
  state.visualPollTimerId = null;
  const previousActiveBySet = new Set(state.visualJobs.filter(isVisualJobActive).map((job) => job.setId));
  try {
    state.visualJobs = await loadVisualJobs();
    renderSetList();
    renderVisualControls();
    const editorJob = getLatestVisualJob(state.editorSetId);
    if (state.editorSetId && previousActiveBySet.has(state.editorSetId) && !isVisualJobActive(editorJob)) {
      await refreshEditorVisualWorkspace();
    }
  } catch (error) {
    console.error("Unable to poll visual jobs:", error);
  } finally {
    scheduleVisualJobPolling();
  }
}

function getEditorCardSideLabels() {
  return {
    front: elements.setSourceLabelInput.value.trim() || "Vorderseite",
    back: elements.setTargetLabelInput.value.trim() || "Rückseite",
  };
}

function updateEditorCardSideLabels() {
  const sideLabels = getEditorCardSideLabels();
  for (const side of ["front", "back"]) {
    for (const label of elements.setCardList.querySelectorAll(`[data-card-side-label="${side}"]`)) {
      label.textContent = sideLabels[side];
    }
  }
}

function createEditorInput(labelText, value, onInput, { compact = false, side = "" } = {}) {
  const label = document.createElement("label");
  label.className = compact ? "set-editor-field set-editor-field--card" : "set-editor-field";
  const labelCopy = document.createElement("span");
  labelCopy.textContent = labelText;
  if (side) {
    labelCopy.dataset.cardSideLabel = side;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(labelCopy, input);
  return label;
}

function setEditorFiles(files, { append = false } = {}) {
  const candidates = append ? [...state.editorFiles, ...files] : files;
  const uniqueFiles = [];
  const seenFiles = new Set();
  for (const file of candidates) {
    if (!(file instanceof File)) {
      continue;
    }
    const identity = [file.name, file.size, file.type, file.lastModified].join(":");
    if (seenFiles.has(identity)) {
      continue;
    }
    seenFiles.add(identity);
    uniqueFiles.push(file);
  }

  state.editorFiles = uniqueFiles.slice(0, 4);
  renderEditorFilePreviews();
  elements.setImportFileSummary.textContent = state.editorFiles.length
    ? `${state.editorFiles.length} Datei${state.editorFiles.length === 1 ? "" : "en"} ausgewählt${uniqueFiles.length > 4 ? " · maximal 4" : ""}`
    : state.importConfigured
      ? ""
      : "KI-Import braucht OPENAI_API_KEY";
}

function renderEditorFilePreviews() {
  for (const previewUrl of state.editorFilePreviewUrls) {
    URL.revokeObjectURL(previewUrl);
  }
  state.editorFilePreviewUrls = [];
  elements.setImportPreviewList.replaceChildren();

  const hasFiles = state.editorFiles.length > 0;
  elements.setImportDropzone.classList.toggle("has-files", hasFiles);
  elements.setImportPreviewList.hidden = !hasFiles;
  elements.setImportFilePicker.disabled = state.editorFiles.length >= 4;
  elements.setImportPickerTitle.textContent = hasFiles
    ? state.editorFiles.length >= 4
      ? "Maximal 4 Inhalte"
      : "Weitere Inhalte hinzufügen"
    : "Datei auswählen oder ablegen";

  state.editorFiles.forEach((file, index) => {
    const card = document.createElement("article");
    card.className = "set-import-preview-card";

    const visual = document.createElement("div");
    visual.className = "set-import-preview-card__visual";
    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      state.editorFilePreviewUrls.push(previewUrl);
      const image = document.createElement("img");
      image.className = "set-import-preview-card__image";
      image.src = previewUrl;
      image.alt = `Vorschau ${file.name}`;
      visual.append(image);
    } else {
      const typeLabel = getImportFileTypeLabel(file);
      const icon = document.createElement("span");
      icon.className = "set-import-preview-card__file-icon";
      icon.dataset.fileType = typeLabel;
      icon.textContent = typeLabel;
      icon.setAttribute("aria-label", `${typeLabel}-Datei`);
      visual.append(icon);
    }

    const copy = document.createElement("div");
    copy.className = "set-import-preview-card__copy";
    const name = document.createElement("strong");
    name.className = "set-import-preview-card__name";
    name.textContent = file.name;
    name.title = file.name;
    const size = document.createElement("small");
    size.className = "set-import-preview-card__size";
    size.textContent = formatImportFileSize(file.size);
    copy.append(name, size);

    const remove = document.createElement("button");
    remove.className = "set-import-preview-card__remove";
    remove.type = "button";
    remove.title = `${file.name} entfernen`;
    remove.setAttribute("aria-label", `${file.name} entfernen`);
    remove.append(createButtonIcon(REMOVE_ICON_PATH));
    remove.addEventListener("click", () => {
      setEditorFiles(state.editorFiles.filter((_entry, fileIndex) => fileIndex !== index));
    });

    card.append(visual, copy, remove);
    elements.setImportPreviewList.append(card);
  });
}

function getImportFileTypeLabel(file) {
  const extension = file.name.split(".").pop()?.trim().toUpperCase() || "";
  if (["PDF", "DOCX", "PPTX", "TXT", "MD", "CSV", "TSV"].includes(extension)) {
    return extension;
  }
  if (file.type === "application/pdf") {
    return "PDF";
  }
  return "DATEI";
}

function formatImportFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) {
    return "0 KB";
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
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
      body: {
        text,
        instruction,
        files,
        purpose: state.editorImportMode === "replace" ? "create_set" : "append_cards",
      },
    });
    if (!response.ok) {
      throw createTeacherRequestError(response, "Material konnte nicht verarbeitet werden.");
    }

    const importedCardCount = applyImportDraft(response.data?.draft);
    const wasAppended = state.editorImportMode === "append";
    resetSetImportInputs();
    showSetEditorView("manual");
    if (state.editorSetStatus === "draft") {
      const draftSaved = await persistEditorDraft({ immediate: true });
      if (!draftSaved) {
        return;
      }
    }
    elements.setEditorFeedback.textContent = response.data?.importMethod === "openai"
      ? `${importedCardCount} Vokabel${importedCardCount === 1 ? "" : "n"} automatisch ${wasAppended ? "hinzugefügt" : "erstellt"}. Bitte kurz prüfen.`
      : `${importedCardCount} Vokabel${importedCardCount === 1 ? "" : "n"} ${wasAppended ? "hinzugefügt" : "übernommen"}. Bitte kurz prüfen.`;
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
    throw new Error("Der Entwurf enthält keine Vokabeln.");
  }
  const importedCards = draft.cards.map(normalizeEditorCard).filter(Boolean);

  if (importedCards.length === 0) {
    throw new Error("Der Entwurf enthält keine vollständigen Vokabeln.");
  }

  const shouldAppend = state.editorImportMode === "append";

  if (shouldAppend) {
    const existingCards = state.editorCards.filter((card) => card.front.trim() || card.back.trim());
    state.editorCards = [...existingCards, ...importedCards];

    if (!state.editorSetId) {
      elements.setTitleInput.value = elements.setTitleInput.value || draft.title || "Neues Lernset";
      elements.setSubjectInput.value = elements.setSubjectInput.value || draft.subject || "";
      elements.setDescriptionInput.value = elements.setDescriptionInput.value || draft.description || "";
    }
  } else {
    elements.setTitleInput.value = draft.title || elements.setTitleInput.value || "Neues Lernset";
    elements.setSubjectInput.value = draft.subject || "";
    elements.setDescriptionInput.value = draft.description || "";
    state.editorSideSelection = { front: "", back: "" };
    applyEditorSideSelection();
    state.editorCards = importedCards;
  }

  renderEditorCards();
  scheduleEditorDraftSave();
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

function scheduleEditorDraftSave() {
  if (state.editorSetStatus !== "draft") {
    return;
  }
  state.editorDraftVersion += 1;
  if (state.editorAutosaveTimerId) {
    window.clearTimeout(state.editorAutosaveTimerId);
  }
  const { payload } = buildEditorDraftPayload();
  if (!state.editorSetId && !state.editorAutosavePromise && hasMeaningfulEditorDraft(payload)) {
    state.editorAutosaveTimerId = null;
    void persistEditorDraft();
    return;
  }
  state.editorAutosaveTimerId = window.setTimeout(() => {
    state.editorAutosaveTimerId = null;
    void persistEditorDraft();
  }, 700);
}

function buildEditorDraftPayload() {
  const cardRefs = [];
  const cards = [];
  for (const card of state.editorCards) {
    const front = card.front.trim();
    const back = card.back.trim();
    if (!front && !back) {
      continue;
    }
    cardRefs.push(card);
    cards.push({
      id: card.id,
      front,
      back,
      acceptedAnswers: [
        back,
        ...card.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean),
      ].filter(Boolean),
    });
  }

  return {
    cardRefs,
    payload: {
      title: elements.setTitleInput.value,
      subject: elements.setSubjectInput.value,
      description: elements.setDescriptionInput.value,
      sourceLabel: elements.setSourceLabelInput.value,
      targetLabel: elements.setTargetLabelInput.value,
      sourceLanguage: state.editorMetadata.sourceLanguage,
      targetLanguage: state.editorMetadata.targetLanguage,
      sidePreset: window.LerndeckSetSides.resolve(state.editorSideSelection.front, state.editorSideSelection.back)?.preset || null,
      cards,
    },
  };
}

function hasMeaningfulEditorDraft(payload) {
  return Boolean(
    payload.title.trim()
    || payload.subject.trim()
    || payload.description.trim()
    || payload.cards.length > 0
  );
}

async function persistEditorDraft({ immediate = false } = {}) {
  if (state.editorSetStatus !== "draft") {
    return true;
  }
  if (state.editorAutosaveTimerId) {
    window.clearTimeout(state.editorAutosaveTimerId);
    state.editorAutosaveTimerId = null;
  }
  if (state.editorAutosavePromise) {
    const previousSaveSucceeded = await state.editorAutosavePromise;
    if (!previousSaveSucceeded && immediate) {
      return false;
    }
  }
  if (state.editorSavedDraftVersion >= state.editorDraftVersion) {
    return true;
  }

  const { payload, cardRefs } = buildEditorDraftPayload();
  if (!hasMeaningfulEditorDraft(payload)) {
    return true;
  }

  const saveVersion = state.editorDraftVersion;
  const keepalive = JSON.stringify(payload).length <= 60_000;
  const path = state.editorSetId
    ? `/api/teacher/set-drafts/${encodeURIComponent(state.editorSetId)}`
    : "/api/teacher/set-drafts";
  elements.setEditorFeedback.textContent = "Entwurf wird gespeichert …";

  const saveOperation = (async () => {
    try {
      const response = await requestJson(path, {
        method: state.editorSetId ? "PUT" : "POST",
        auth: "teacher",
        body: payload,
        keepalive,
      });
      if (!response.ok) {
        throw createTeacherRequestError(response, "Entwurf konnte nicht gespeichert werden.");
      }

      const savedSet = response.data?.set;
      state.editorSetId = typeof savedSet?.id === "string" ? savedSet.id : state.editorSetId;
      state.editorSetStatus = savedSet?.status === "draft" ? "draft" : state.editorSetStatus;
      const savedCards = Array.isArray(savedSet?.cards) ? savedSet.cards : [];
      cardRefs.forEach((card, index) => {
        if (!card.id && typeof savedCards[index]?.id === "string") {
          card.id = savedCards[index].id;
        }
      });
      state.editorSavedDraftVersion = Math.max(state.editorSavedDraftVersion, saveVersion);
      elements.setEditorTitle.textContent = "Entwurf bearbeiten";
      updateEditorStatusUi();
      elements.setEditorFeedback.textContent = "Entwurf gespeichert";
      return true;
    } catch (error) {
      if (error?.requiresAuth) {
        showTeacherAuth(error.message);
        return false;
      }
      console.error("Unable to autosave set draft:", error);
      elements.setEditorFeedback.textContent = error.message || "Entwurf konnte nicht gespeichert werden.";
      return false;
    }
  })();

  state.editorAutosavePromise = saveOperation;
  const succeeded = await saveOperation;
  if (state.editorAutosavePromise === saveOperation) {
    state.editorAutosavePromise = null;
  }
  if (succeeded && state.editorDraftVersion > state.editorSavedDraftVersion && !immediate) {
    state.editorAutosaveTimerId = window.setTimeout(() => {
      state.editorAutosaveTimerId = null;
      void persistEditorDraft();
    }, 250);
  }
  if (immediate && succeeded && state.editorDraftVersion > state.editorSavedDraftVersion) {
    return persistEditorDraft({ immediate: true });
  }
  return succeeded;
}

async function handleSaveSet(event) {
  event.preventDefault();
  if (!requireEditorSideSelection()) return;
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
    elements.setEditorFeedback.textContent = `Vokabel ${incompleteCardIndex + 1} ist noch unvollständig.`;
    return;
  }
  const cards = preparedCards.filter((card) => card.front && card.back);

  if (!elements.setTitleInput.value.trim()) {
    elements.setEditorFeedback.textContent = "Bitte einen Titel eingeben.";
    elements.setTitleInput.focus();
    return;
  }
  if (cards.length === 0) {
    elements.setEditorFeedback.textContent = "Mindestens eine vollständige Vokabel ist erforderlich.";
    return;
  }

  if (state.editorSetStatus === "draft") {
    const draftSaved = await persistEditorDraft({ immediate: true });
    if (!draftSaved) {
      return;
    }
  }

  const payload = {
    title: elements.setTitleInput.value,
    subject: elements.setSubjectInput.value,
    description: elements.setDescriptionInput.value,
    sourceLabel: elements.setSourceLabelInput.value,
    targetLabel: elements.setTargetLabelInput.value,
    sourceLanguage: state.editorMetadata.sourceLanguage,
    targetLanguage: state.editorMetadata.targetLanguage,
    sidePreset: window.LerndeckSetSides.resolve(state.editorSideSelection.front, state.editorSideSelection.back).preset,
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
    const savedSet = normalizeSetEntry(response.data?.set);
    state.editorSetId = savedSet?.id || state.editorSetId;
    state.editorSetStatus = "published";
    state.editorSavedDraftVersion = state.editorDraftVersion;
    updateEditorStatusUi();
    await reloadTeacherData();
    await closeSetEditor({ skipDraftSave: true });
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
  if (TAFELRAUM_EMBED) headers["X-Lerndeck-Embed"] = "tafelraum";
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    credentials: "same-origin",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    keepalive: Boolean(options.keepalive),
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
