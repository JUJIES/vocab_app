const state = {
  appMode: "home",
  accessRegistrationOpen: false,
  accessShareExpanded: false,
  accessUseAlternate: false,
  accessKnownDeviceFeedback: "",
  availableTablets: [],
  requestedSetPath: "",
  requestedSetUrl: "",
  currentSetPath: "",
  currentSetUrl: "",
  currentSetBaseUrl: "",
  subscriptions: [],
  allCards: [],
  setStorageKey: "",
  starStates: {},
  cards: [],
  roundMode: "main",
  currentIndex: 0,
  currentCard: null,
  roundNumber: 1,
  roundUnknownCards: [],
  isComplete: false,
  summaryMode: null,
  pendingNextRoundCards: [],
  pendingNextRoundNumber: null,
  pendingStarReviewCards: [],
  summaryRoundKnownCount: 0,
  summaryRoundUnknownCount: 0,
  hasStartedStarReview: false,
  knownCount: 0,
  unknownCount: 0,
  isFlipped: false,
  flipRotationDeg: 0,
  flipMotionId: null,
  flipResetId: null,
  hasRevealedAnswer: false,
  hintLevel: 0,
  hintReady: false,
  hintDelayId: null,
  hintProgressCycle: 0,
  swipeActive: false,
  swipeMoved: false,
  swipePointerId: null,
  swipePointerType: "",
  swipeCardWidth: 0,
  swipeStartX: 0,
  swipeStartY: 0,
  swipeDeltaX: 0,
  swipeDeltaY: 0,
  swipeHasRenderedMove: false,
  swipeMetrics: null,
  swipeSettleId: null,
  swipeFrameId: null,
  starCommitId: null,
  suppressNextClick: false,
  ignoreCardClickUntil: 0,
  suppressAudioClickUntil: 0,
  audioPlayer: null,
  screenPrimaryAction: "",
  screenSecondaryAction: "",
  pendingLaunchSetPath: "",
  pendingLaunchSetTitle: "",
  addSetModalView: "choice",
  studentSetModalMode: "",
  activeStudentSetPath: "",
  activeStudentSetTitle: "",
  activeStudentSetShareUrl: "",
  publicOrigin: "",
  activeTabletPairingId: "",
  learningProgressSavePending: false,
};

const APP_MODES = Object.freeze({
  ACCESS: "access",
  HOME: "home",
  SCANNER: "scanner",
  REGISTRATION: "registration",
  PIN: "pin",
  FLASHCARD: "flashcard",
  LOAD_ERROR: "load-error",
});

const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";
const STAR_SEQUENCE = ["none", "green", "yellow", "orange"];
const EXAMPLE_SET_QUERY_PATH = "sets/food-basics-01.json";
const DEFAULT_TABLET_ID = "rot-1";
const DEFAULT_TABLET_LABEL = "Rot 1";
const TABLET_DIRECTORY_API_PATH = "/api/tablet-directory";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const ACCESS_CONTINUE_ICON_PATH = "./assets/icons/continue-session.svg";
const ACCESS_REGISTER_ICON_PATH = "./assets/icons/key-access.svg";

const elements = {
  appShell: document.querySelector(".app-shell"),
  studentScreen: document.getElementById("student-screen"),
  studentScreenKicker: document.getElementById("student-screen-kicker"),
  studentScreenTitle: document.getElementById("student-screen-title"),
  studentScreenMessage: document.getElementById("student-screen-message"),
  studentScreenDetail: document.getElementById("student-screen-detail"),
  studentScreenForm: document.getElementById("student-screen-form"),
  studentScreenPrimaryAction: document.getElementById("student-screen-primary-action"),
  studentScreenSecondaryAction: document.getElementById("student-screen-secondary-action"),
  studentShareBlock: document.getElementById("student-share-block"),
  studentShareQr: document.getElementById("student-share-qr"),
  studentShareCopy: document.getElementById("student-share-copy"),
  studentShareFeedback: document.getElementById("student-share-feedback"),
  launchModeModal: document.getElementById("launch-mode-modal"),
  launchModeTitle: document.getElementById("launch-mode-title"),
  launchModeStart: document.getElementById("launch-mode-start"),
  launchModeCancel: document.getElementById("launch-mode-cancel"),
  launchModeClose: document.getElementById("launch-mode-close"),
  addSetModal: document.getElementById("add-set-modal"),
  addSetClose: document.getElementById("add-set-close"),
  addSetBody: document.getElementById("add-set-body"),
  studentSetModal: document.getElementById("student-set-modal"),
  studentSetModalClose: document.getElementById("student-set-modal-close"),
  studentSetModalBody: document.getElementById("student-set-modal-body"),
  studentHomeLink: document.getElementById("student-home-link"),
  cardStage: document.getElementById("card-stage"),
  flashcard: document.getElementById("flashcard"),
  flashcardMotion: document.getElementById("flashcard-motion"),
  progressShell: document.getElementById("progress-shell"),
  progressLabel: document.getElementById("progress-label"),
  progressFill: document.getElementById("progress-fill"),
  knownCounts: document.querySelectorAll("[data-known-count]"),
  unknownCounts: document.querySelectorAll("[data-unknown-count]"),
  starButtons: document.querySelectorAll("[data-star-button]"),
  audioButtons: document.querySelectorAll("[data-audio-button]"),
  evalButtons: document.querySelectorAll("[data-eval-button]"),
  frontContent: document.getElementById("front-content"),
  frontFace: document.getElementById("front-face"),
  backFace: document.getElementById("back-face"),
  cardAction: document.getElementById("card-action"),
  frontWord: document.getElementById("front-word"),
  frontHint: document.getElementById("front-hint"),
  backWord: document.getElementById("back-word"),
  backHint: document.getElementById("back-hint"),
  statusMessage: document.getElementById("status-message"),
};

let addSetScanner = null;
let addSetScanHandled = false;
let tabletDirectoryPromise = null;
const qrModuleCountCache = new Map();
const QR_PROBE_SIZE = 997;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  registerServiceWorker();
  void initializeStudentShareOrigin();
  initializeStudentApp();
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Unable to register service worker:", error);
    });
  });
}

function bindEvents() {
  elements.flashcard.addEventListener("click", handleCardClick);
  elements.flashcard.addEventListener("keydown", handleCardKeydown);
  elements.flashcard.addEventListener("pointerdown", handleSwipePointerDown);
  elements.flashcard.addEventListener("pointermove", handleSwipePointerMove);
  elements.flashcard.addEventListener("pointerup", handleSwipePointerUp);
  elements.flashcard.addEventListener("pointercancel", handleSwipePointerCancel);
  elements.cardAction.addEventListener("click", handlePrimaryAction);
  elements.cardAction.addEventListener("pointerdown", handleControlPointerDown);
  elements.cardAction.addEventListener("pointerup", stopControlEventPropagation);
  for (const starButton of elements.starButtons) {
    starButton.addEventListener("click", handleStarAction);
    starButton.addEventListener("pointerdown", handleControlPointerDown);
    starButton.addEventListener("pointerup", stopControlEventPropagation);
  }
  for (const audioButton of elements.audioButtons) {
    audioButton.addEventListener("click", handleAudioAction);
    audioButton.addEventListener("pointerdown", handleControlPointerDown);
    audioButton.addEventListener("pointerup", handleAudioPointerUp);
  }
  for (const evalButton of elements.evalButtons) {
    evalButton.addEventListener("click", handleEvalAction);
    evalButton.addEventListener("pointerdown", handleControlPointerDown);
    evalButton.addEventListener("pointerup", stopControlEventPropagation);
  }
  window.addEventListener("keydown", handleWindowKeydown);
  elements.studentScreenPrimaryAction.addEventListener("click", handleStudentScreenPrimaryAction);
  elements.studentScreenSecondaryAction.addEventListener("click", handleStudentScreenSecondaryAction);
  elements.studentShareCopy.addEventListener("click", handleStudentShareCopy);
  elements.studentHomeLink.addEventListener("click", handleReturnToStudentHome);
  elements.launchModeStart.addEventListener("click", handleLaunchModeStart);
  elements.launchModeCancel.addEventListener("click", closeLaunchModeModal);
  elements.launchModeClose.addEventListener("click", closeLaunchModeModal);
  elements.launchModeModal.addEventListener("click", handleLaunchModeOverlayClick);
  elements.addSetClose.addEventListener("click", closeAddSetModal);
  elements.addSetModal.addEventListener("click", handleAddSetModalOverlayClick);
  elements.studentSetModalClose.addEventListener("click", closeStudentSetModal);
  elements.studentSetModal.addEventListener("click", handleStudentSetModalOverlayClick);
  document.addEventListener("click", handleDocumentClick);
}

async function initializeStudentApp() {
  const setRequest = resolveRequestedSetRequest();

  if (!setRequest.hasSetParam) {
    state.requestedSetPath = "";
    state.requestedSetUrl = "";
    await continueStudentAccessFlow();
    return;
  }

  if (!setRequest.isValid) {
    renderStudentLoadErrorState({
      title: "Link ungültig",
      message: "Bitte Link prüfen.",
      detail: "",
      primaryAction: "",
      primaryLabel: "",
      secondaryAction: "clear-set",
      secondaryLabel: "Start",
    });
    return;
  }

  state.requestedSetPath = setRequest.path;
  state.requestedSetUrl = setRequest.url;
  await continueStudentAccessFlow();
}

async function startFlashcardSet(setPath, setUrl = new URL(setPath, getAppBaseUrl()).href) {
  state.currentSetPath = setPath;
  state.currentSetUrl = setUrl;
  state.currentSetBaseUrl = new URL("./", setUrl).href;
  setStudentAppMode(APP_MODES.FLASHCARD);
  renderLoadingState();

  try {
    const data = await loadSet(setUrl);
    const tabletId = loadLocalTabletId();

    if (!tabletId) {
      throw new Error("Tablet ist nicht angemeldet.");
    }

    state.setStorageKey = getSetStorageKey(data);
    state.starStates = await loadServerLearningProgress(tabletId, setPath, state.setStorageKey);
    state.allCards = buildCards(data);
    state.hasStartedStarReview = false;
    state.knownCount = 0;
    state.unknownCount = 0;
    startRound(state.allCards, 1);
  } catch (error) {
    if (error && (error.message === "TABLET_DECOUPLED" || error.message === "TABLET_AUTH_REQUIRED")) {
      return;
    }

    console.error("Unable to start flashcard set:", error);
    renderStudentLoadErrorState({
      title: "Set nicht verfügbar",
      message: "Set konnte nicht geöffnet werden.",
      detail: "",
      primaryAction: "retry-set",
      primaryLabel: "Erneut",
      secondaryAction: "clear-set",
      secondaryLabel: "Start",
    });
  }
}

async function continueStudentAccessFlow() {
  const localTabletId = loadLocalTabletId();
  state.accessShareExpanded = false;
  state.accessUseAlternate = false;
  await ensureTabletDirectoryLoaded();

  if (localTabletId && hasUnlockedStudentSession() && hasTabletSessionToken(localTabletId)) {
    await continueAfterDeviceAccess(localTabletId);
    return;
  }

  renderAccessState({
    loginTabletId: localTabletId,
    registrationTabletId: localTabletId || DEFAULT_TABLET_ID,
    showRegistration: false,
  });
}

async function continueAfterDeviceAccess(tabletId) {
  persistLocalTabletId(tabletId);
  persistStudentSessionUnlock();

  if (state.requestedSetPath) {
    const requestedSetPath = state.requestedSetPath;
    const setIntent = await getRequestedSetIntent(tabletId, requestedSetPath);

    if (setIntent.requiresRegistration) {
      clearLocalTabletId();
      clearStudentSessionUnlock();
      clearTabletSession();
      clearActiveTabletContext();
      resetTabletDirectoryCache();
      await ensureTabletDirectoryLoaded();
      renderAccessState({
        loginTabletId: "",
        registrationTabletId: tabletId,
        registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Lernsets und ohne Lernstände.",
        showRegistration: true,
      });
      return;
    }

    if (setIntent.authRequired) {
      return;
    }

    const subscriptionResult = await subscribeTabletToSet(tabletId, requestedSetPath);

    if (subscriptionResult.authRequired) {
      return;
    }

    if (!subscriptionResult.ok) {
      renderStudentLoadErrorState({
        title: "Lernset nicht abonniert",
        message: "Bitte erneut versuchen.",
        detail: subscriptionResult.error,
        primaryAction: "retry-set",
        primaryLabel: "Erneut",
        secondaryAction: "go-home",
        secondaryLabel: "Zur Übersicht",
      });
      return;
    }

    state.requestedSetPath = "";
    state.requestedSetUrl = "";
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("set");
    window.history.replaceState({}, "", nextUrl);

    await renderStudentHome(tabletId, {
      feedback: setIntent.isSubscribed
        ? "Schon abonniert."
        : "Abonniert.",
      highlightedSetPath: requestedSetPath,
      highlightedSetLabel: setIntent.isSubscribed ? "Schon abonniert" : "Neu abonniert",
    });
    return;
  }

  await renderStudentHome(tabletId);
}

async function loadSet(setUrl) {
  const response = await fetch(setUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function resolveRequestedSetRequest() {
  const params = new URLSearchParams(window.location.search);
  const rawSet = params.get("set")?.trim();

  if (!rawSet) {
    return {
      hasSetParam: false,
      isValid: false,
      path: "",
      url: "",
      detail: "",
    };
  }

  const normalizedSetPath = normalizeSetPath(rawSet);
  const invalidRequest = {
    hasSetParam: true,
    isValid: false,
    path: "",
    url: "",
    detail: "",
  };

  if (!normalizedSetPath) {
    return invalidRequest;
  }

  return {
    hasSetParam: true,
    isValid: true,
    path: normalizedSetPath,
    url: new URL(normalizedSetPath, getAppBaseUrl()).href,
    detail: "",
  };
}

function getAppBaseUrl() {
  return new URL("./", window.location.href);
}

function setStudentAppMode(mode) {
  state.appMode = mode;
  if (mode !== APP_MODES.ACCESS) {
    delete elements.appShell.dataset.accessState;
  }
  if (mode !== APP_MODES.HOME) {
    closeLaunchModeModal();
  }
  elements.appShell.dataset.appMode = mode;
  elements.studentScreen.hidden = mode === APP_MODES.FLASHCARD;
  elements.cardStage.hidden = mode !== APP_MODES.FLASHCARD;
  updateStudentShareBlock();
}

function renderStudentScreen({
  mode,
  title,
  message,
  detail = "",
  kicker = "Student",
  primaryAction = "",
  primaryLabel = "",
  secondaryAction = "",
  secondaryLabel = "",
}) {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  clearFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();

  state.screenPrimaryAction = primaryAction;
  state.screenSecondaryAction = secondaryAction;

  setStudentAppMode(mode);
  elements.studentScreenKicker.textContent = kicker;
  elements.studentScreenTitle.textContent = title;
  const resolvedMessage = setScreenTextOrNode(elements.studentScreenMessage, message);
  const resolvedDetail = setScreenTextOrNode(elements.studentScreenDetail, detail);
  clearStudentScreenForm();
  configureStudentScreenAction(
    elements.studentScreenPrimaryAction,
    primaryAction,
    primaryLabel,
  );
  configureStudentScreenAction(
    elements.studentScreenSecondaryAction,
    secondaryAction,
    secondaryLabel,
  );
  elements.statusMessage.textContent = [title, resolvedMessage, resolvedDetail].filter(Boolean).join(". ");
  updateStudentShareBlock();
}

function setScreenTextOrNode(element, content) {
  element.replaceChildren();

  if (content instanceof Node) {
    element.append(content);
    return element.textContent.trim();
  }

  const text = typeof content === "string" ? content : "";
  element.textContent = text;
  return text.trim();
}

async function initializeStudentShareOrigin() {
  try {
    const response = await apiRequest("/api/runtime-info");
    state.publicOrigin = typeof response?.data?.publicOrigin === "string"
      ? response.data.publicOrigin.trim()
      : "";
  } catch (_error) {
    state.publicOrigin = "";
  }

  updateStudentShareBlock();
}

function shouldShowStudentShareBlock() {
  return (state.appMode === APP_MODES.ACCESS && state.accessShareExpanded)
    || state.appMode === APP_MODES.SCANNER
    || state.appMode === APP_MODES.LOAD_ERROR;
}

function updateStudentShareBlock() {
  if (!elements.studentShareBlock) {
    return;
  }

  const isVisible = shouldShowStudentShareBlock();
  const inAccessMode = state.appMode === APP_MODES.ACCESS;
  const shouldRenderQr = isVisible || (inAccessMode && state.accessShareExpanded);

  if (inAccessMode) {
    elements.studentShareBlock.hidden = false;
    elements.studentShareBlock.classList.toggle("is-revealed", state.accessShareExpanded);
    elements.studentShareBlock.setAttribute("aria-hidden", state.accessShareExpanded ? "false" : "true");
  } else {
    elements.studentShareBlock.hidden = !isVisible;
    elements.studentShareBlock.classList.toggle("is-revealed", isVisible);
    elements.studentShareBlock.setAttribute("aria-hidden", isVisible ? "false" : "true");
  }

  if (!shouldRenderQr) {
    return;
  }

  const shareUrl = buildStudentShareUrlForCurrentLocation();
  elements.studentShareBlock.dataset.shareUrl = shareUrl;
  elements.studentShareCopy.setAttribute("data-share-url", shareUrl);
  elements.studentShareFeedback.textContent = "";
  elements.studentShareFeedback.classList.remove("is-success");

  if (window.QRious && elements.studentShareQr) {
    requestAnimationFrame(() => {
      renderQrIntoCanvas(elements.studentShareQr, shareUrl, {
        foreground: "#1f1f1f",
      });
    });
  }
}

function renderQrIntoCanvas(canvas, value, {
  foreground = "#1f1f1f",
  background = "#f7f9fc",
  level = "M",
} = {}) {
  if (!canvas || !window.QRious) {
    return;
  }

  const canvasSize = resolveQrCanvasSize(canvas, value, { level });
  const frame = canvas.parentElement;

  if (frame instanceof HTMLElement) {
    frame.style.width = `${canvasSize}px`;
    frame.style.height = `${canvasSize}px`;
  }

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
  const availableSize = getQrAvailableSize(canvas);
  const moduleCount = inferQrModuleCount(value, { level });

  if (!moduleCount) {
    return availableSize;
  }

  const moduleSize = Math.max(1, Math.floor(availableSize / moduleCount));
  return Math.max(moduleCount, moduleCount * moduleSize);
}

function getQrAvailableSize(canvas) {
  const shell = canvas.closest(".student-share__qr-shell");

  if (shell instanceof HTMLElement) {
    const styles = window.getComputedStyle(shell);
    const availableWidth = shell.clientWidth
      - parseFloat(styles.paddingLeft || "0")
      - parseFloat(styles.paddingRight || "0");
    const availableHeight = shell.clientHeight
      - parseFloat(styles.paddingTop || "0")
      - parseFloat(styles.paddingBottom || "0");
    const nextSize = Math.min(
      availableWidth || 0,
      availableHeight || availableWidth || 0,
    );

    if (nextSize > 0) {
      return Math.max(64, Math.round(nextSize));
    }
  }

  const rect = canvas.getBoundingClientRect();
  return Math.max(
    64,
    Math.round(
      Math.min(rect.width || canvas.width || 0, rect.height || canvas.height || 0)
      || canvas.width
      || 220,
    ),
  );
}

function inferQrModuleCount(value, {
  level = "M",
} = {}) {
  const cacheKey = `${level}:${value}`;

  if (qrModuleCountCache.has(cacheKey)) {
    return qrModuleCountCache.get(cacheKey);
  }

  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = QR_PROBE_SIZE;
  probeCanvas.height = QR_PROBE_SIZE;

  new window.QRious({
    element: probeCanvas,
    value,
    size: QR_PROBE_SIZE,
    level,
    padding: 0,
    foreground: "#000000",
    background: "#ffffff",
  });

  const contentSize = measureQrContentSize(probeCanvas);
  const candidates = [];

  for (let moduleCount = 21; moduleCount <= 177; moduleCount += 4) {
    if (Math.floor(QR_PROBE_SIZE / moduleCount) * moduleCount === contentSize) {
      candidates.push(moduleCount);
    }
  }

  const resolvedModuleCount = candidates[0] || null;
  qrModuleCountCache.set(cacheKey, resolvedModuleCount);
  return resolvedModuleCount;
}

function measureQrContentSize(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return 0;
  }

  const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];

      if (alpha > 0 && red < 250) {
        if (x > maxX) {
          maxX = x;
        }

        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }

  return Math.max(maxX + 1, maxY + 1, 0);
}

function buildStudentShareUrlForCurrentLocation() {
  const origin = state.publicOrigin || window.location.origin;
  const currentUrl = new URL(window.location.href);
  const shareUrl = new URL(currentUrl.pathname || "/index.html", `${origin}/`);
  shareUrl.search = currentUrl.search;
  shareUrl.hash = currentUrl.hash;
  return shareUrl.href;
}

async function handleStudentShareCopy() {
  const shareUrl = elements.studentShareCopy?.dataset.shareUrl?.trim() || "";

  if (!shareUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    elements.studentShareFeedback.textContent = "Link kopiert.";
    elements.studentShareFeedback.classList.add("is-success");
  } catch (error) {
    elements.studentShareFeedback.textContent = "Kopieren fehlgeschlagen.";
    elements.studentShareFeedback.classList.remove("is-success");
  }
}

function clearStudentScreenForm() {
  elements.studentScreenForm.replaceChildren();
  elements.studentScreenForm.hidden = true;
}

function createStudentShareUtilityButton() {
  const utility = document.createElement("button");
  utility.type = "button";
  utility.className = "student-screen__access-utility";
  utility.setAttribute("aria-expanded", state.accessShareExpanded ? "true" : "false");

  const iconShell = document.createElement("span");
  iconShell.className = "student-screen__access-utility-icon";

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "qr_code_2";
  iconShell.append(icon);

  const label = document.createElement("span");
  label.className = "student-screen__access-utility-label";
  label.textContent = state.accessShareExpanded ? "QR-Code ausblenden" : "QR-Code anzeigen";

  utility.append(iconShell, label);
  utility.addEventListener("click", () => {
    state.accessShareExpanded = !state.accessShareExpanded;
    utility.setAttribute("aria-expanded", state.accessShareExpanded ? "true" : "false");
    label.textContent = state.accessShareExpanded ? "QR-Code ausblenden" : "QR-Code anzeigen";
    updateStudentShareBlock();
  });

  return utility;
}

function createDeviceContextRow(tabletId, {
  prefix = "Tablet",
} = {}) {
  const row = document.createElement("span");
  row.className = "student-screen__device-message";

  const label = document.createElement("span");
  label.className = "student-screen__device-message-label";
  label.textContent = prefix;

  row.append(label, createDevicePill(getTabletMeta(tabletId)));
  return row;
}

function createDevicePill(tablet, {
  className = "",
} = {}) {
  const pill = document.createElement("span");
  pill.className = ["device-pill", className].filter(Boolean).join(" ");
  pill.dataset.tabletGroup = getTabletGroupName(tablet.label || tablet.id);

  const icon = document.createElement("img");
  icon.className = "device-pill__icon";
  icon.src = TABLET_ICON_PATH;
  icon.alt = "";
  icon.decoding = "async";

  const label = document.createElement("span");
  label.className = "device-pill__label";
  label.textContent = tablet.label || formatTabletLabel(tablet.id);

  pill.append(icon, label);
  return pill;
}

function createAccessChoiceCard({
  title,
  text,
  iconPath = TABLET_ICON_PATH,
  onClick,
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "student-screen__access-choice";
  button.addEventListener("click", onClick);

  const iconShell = document.createElement("span");
  iconShell.className = "student-screen__access-choice-icon";

  const icon = document.createElement("img");
  icon.className = "student-screen__access-choice-icon-image";
  icon.src = iconPath;
  icon.alt = "";
  icon.decoding = "async";
  iconShell.append(icon);

  const copy = document.createElement("span");
  copy.className = "student-screen__access-choice-copy";

  const titleElement = document.createElement("span");
  titleElement.className = "student-screen__access-choice-title";
  titleElement.textContent = title;

  const textElement = document.createElement("span");
  textElement.className = "student-screen__access-choice-text";
  textElement.textContent = text;

  copy.append(titleElement, textElement);
  button.append(iconShell, copy);
  return button;
}

function configureStudentScreenAction(button, action, label) {
  const isVisible = Boolean(action && label);
  button.hidden = !isVisible;
  button.disabled = !isVisible;
  button.textContent = isVisible ? label : "";
}

function renderScannerPlaceholderState({ allowHomeReturn = false } = {}) {
  void allowHomeReturn;
  openAddSetModal();
}

function renderAccessState({
  loginTabletId = "",
  loginFeedback = "",
  knownDeviceFeedback = "",
  registrationTabletId = "",
  registrationFeedback = "",
  showRegistration = false,
} = {}) {
  const localTabletId = loadLocalTabletId();
  const hasKnownDevice = Boolean(localTabletId);
  const showContinueState = hasKnownDevice && !state.accessUseAlternate;
  const showChooserState = !showContinueState
    && !showRegistration
    && (
      (!hasKnownDevice && !state.accessUseAlternate)
      || (state.accessUseAlternate && !loginTabletId && !registrationTabletId)
    );
  const loginTablets = getLoginTablets();
  const registrationTablets = getRegistrationTablets();

  state.accessRegistrationOpen = showRegistration;
  state.accessKnownDeviceFeedback = knownDeviceFeedback;

  renderStudentScreen({
    mode: APP_MODES.ACCESS,
    title: "",
    message: "",
    detail: "",
    kicker: "",
    secondaryAction: !localTabletId && state.requestedSetPath ? "clear-set" : "",
    secondaryLabel: !localTabletId && state.requestedSetPath ? "Start" : "",
  });
  elements.appShell.dataset.accessState = showContinueState
    ? "continue"
    : (showChooserState ? "chooser" : (showRegistration ? "registration" : "login"));

  const container = document.createElement("div");
  container.className = "student-screen__access";
  container.classList.add(showContinueState ? "student-screen__access--continue" : "student-screen__access--entry");

  if (showContinueState) {
    const quickSection = document.createElement("section");
    quickSection.className = "student-screen__access-card student-screen__access-card--continue";

    const quickHeader = document.createElement("div");
    quickHeader.className = "student-screen__access-section-header";

    const quickTitle = document.createElement("h2");
    quickTitle.className = "student-screen__access-section-title";
    quickTitle.textContent = "Weiterlernen";

    const quickText = document.createElement("p");
    quickText.className = "student-screen__access-section-text";
    quickText.textContent = "Dieses Tablet";

    const quickMeta = document.createElement("p");
    quickMeta.className = "student-screen__access-subtle";
    quickMeta.textContent = "Zuletzt benutzt";

    const quickDeviceCard = createTabletCard(getTabletMeta(localTabletId), {
      selected: true,
      interactive: false,
      statusText: "Dieses Tablet",
    });

    quickHeader.append(quickTitle, quickText);

    const quickForm = document.createElement("form");
    quickForm.className = "student-screen__access-form";
    quickForm.noValidate = true;
    quickForm.dataset.accessVariant = "quick";
    quickForm.addEventListener("submit", handlePinSubmit);
    quickForm.append(
      createHiddenInput("tabletId", localTabletId),
      createStudentField({
        label: "PIN",
        control: createPinInput("pin-entry", "PIN eingeben"),
      }),
      createStudentSubmitButton("Starten"),
      createStudentFeedback(knownDeviceFeedback),
    );

    const quickActions = document.createElement("div");
    quickActions.className = "student-screen__access-inline-actions";

    const otherButton = document.createElement("button");
    otherButton.type = "button";
    otherButton.className = "student-screen__inline-action";
    otherButton.textContent = "Anderes Tablet";
    otherButton.addEventListener("click", () => {
      state.accessUseAlternate = true;
      renderAccessState({
        showRegistration: false,
      });
    });

    quickActions.append(otherButton);
    quickSection.append(quickHeader, quickDeviceCard, quickMeta, quickForm);
    container.append(quickSection, quickActions, createStudentShareUtilityButton());
    elements.studentScreenForm.replaceChildren(container);
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    return;
  }

  if (showChooserState) {
    const chooserSection = document.createElement("section");
    chooserSection.className = "student-screen__access-card student-screen__access-card--chooser";

    const chooserHeader = document.createElement("div");
    chooserHeader.className = "student-screen__access-section-header";

    const chooserTitle = document.createElement("h2");
    chooserTitle.className = "student-screen__access-section-title";
    chooserTitle.textContent = "Start";

    const chooserText = document.createElement("p");
    chooserText.className = "student-screen__access-section-text";
    chooserText.textContent = "Tablet wählen oder neu einrichten.";

    chooserHeader.append(chooserTitle, chooserText);

    const chooserGrid = document.createElement("div");
    chooserGrid.className = "student-screen__access-choice-grid";
    chooserGrid.append(
      createAccessChoiceCard({
        title: "Weiterlernen",
        text: "Mit PIN anmelden.",
        iconPath: ACCESS_CONTINUE_ICON_PATH,
        onClick: () => {
          state.accessUseAlternate = true;
          renderAccessState({
            loginTabletId: resolveTabletSelection("", {
              tablets: loginTablets,
              preferFirstAvailable: loginTablets.length === 1,
            }),
            showRegistration: false,
          });
        },
      }),
      createAccessChoiceCard({
        title: "Neu einrichten",
        text: "Freies Tablet und PIN.",
        iconPath: ACCESS_REGISTER_ICON_PATH,
        onClick: () => {
          state.accessUseAlternate = true;
          renderAccessState({
            registrationTabletId: resolveTabletSelection("", {
              tablets: registrationTablets,
              preferFirstAvailable: registrationTablets.length === 1,
            }),
            showRegistration: true,
          });
        },
      }),
    );

    chooserSection.append(chooserHeader, chooserGrid);
    container.append(chooserSection);

    if (hasKnownDevice) {
      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = "student-screen__inline-action";
      backButton.append("Weiter mit ", createDevicePill(getTabletMeta(localTabletId)));
      backButton.addEventListener("click", () => {
        state.accessUseAlternate = false;
        renderAccessState({
          loginTabletId: localTabletId,
          knownDeviceFeedback,
          showRegistration: false,
        });
      });
      container.append(backButton);
    }

    container.append(createStudentShareUtilityButton());
    elements.studentScreenForm.replaceChildren(container);
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    return;
  }

  if (!showRegistration) {
    const loginSection = document.createElement("section");
    loginSection.className = "student-screen__access-card student-screen__access-card--login";

    const loginHeader = document.createElement("div");
    loginHeader.className = "student-screen__access-section-header";

    const loginTitle = document.createElement("h2");
    loginTitle.className = "student-screen__access-section-title";
    loginTitle.textContent = "Weiterlernen";

    const loginText = document.createElement("p");
    loginText.className = "student-screen__access-section-text";
    loginText.textContent = "Tablet und PIN";

    const resolvedLoginTabletId = resolveTabletSelection(loginTabletId, {
      tablets: loginTablets,
      preferFirstAvailable: loginTablets.length === 1,
    });

    loginHeader.append(loginTitle, loginText);

    const loginForm = document.createElement("form");
    loginForm.className = "student-screen__access-form";
    loginForm.noValidate = true;
    loginForm.dataset.accessVariant = "login";
    loginForm.addEventListener("submit", handlePinSubmit);

    loginForm.append(
      createStudentField({
        label: "Tablet",
        control: createTabletPicker("tabletId", resolvedLoginTabletId, {
          tablets: loginTablets,
          emptyStateText: "Noch kein Tablet eingerichtet. Nutze stattdessen „Neu einrichten“.",
          collapseWhenSelected: hasKnownDevice,
          allowEmptySelection: hasKnownDevice,
        }),
      }),
      createStudentField({
        label: "PIN",
        control: createPinInput("pin-entry", "PIN eingeben"),
      }),
      createStudentSubmitButton("Starten"),
      createStudentFeedback(loginFeedback),
    );

    loginSection.append(loginHeader, loginForm);

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "student-screen__inline-action";
    backButton.textContent = "Zurück";
    backButton.addEventListener("click", () => {
      state.accessUseAlternate = true;
      renderAccessState({
        knownDeviceFeedback,
        showRegistration: false,
      });
    });

    container.append(loginSection, backButton, createStudentShareUtilityButton());
    elements.studentScreenForm.replaceChildren(container);
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    return;
  }

  const registrationSection = document.createElement("section");
  registrationSection.className = "student-screen__access-card student-screen__access-card--setup is-expanded";

  const registrationHeader = document.createElement("div");
  registrationHeader.className = "student-screen__access-section-header";

  const registrationTitle = document.createElement("h2");
  registrationTitle.className = "student-screen__access-section-title";
  registrationTitle.textContent = "Neu einrichten";

  const registrationText = document.createElement("p");
  registrationText.className = "student-screen__access-section-text";
  registrationText.textContent = "Freies Tablet und PIN";

  registrationHeader.append(registrationTitle, registrationText);
  registrationSection.append(registrationHeader);

  const resolvedRegistrationTabletId = resolveTabletSelection(registrationTabletId, {
    tablets: registrationTablets,
    preferFirstAvailable: registrationTablets.length === 1,
  });
  const registrationForm = document.createElement("form");
  registrationForm.className = "student-screen__access-form";
  registrationForm.noValidate = true;
  registrationForm.addEventListener("submit", handleRegistrationSubmit);

  registrationForm.append(
    createStudentField({
      label: "Tablet",
      control: createTabletPicker("tabletId", resolvedRegistrationTabletId, {
        tablets: registrationTablets,
        emptyStateText: "Alle Tablets sind bereits eingerichtet.",
      }),
    }),
    createStudentField({
      label: "PIN",
      control: createPinInput("registration-pin", "Neuen PIN eingeben"),
    }),
    createStudentField({
      label: "PIN bestätigen",
      control: createPinInput("registration-pin-confirm", "PIN wiederholen"),
    }),
    createStudentSubmitButton("Starten"),
    createStudentFeedback(registrationFeedback),
  );

  registrationSection.append(registrationForm);

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "student-screen__inline-action";
  backButton.textContent = "Zurück";
  backButton.addEventListener("click", () => {
    state.accessUseAlternate = true;
    renderAccessState({
      knownDeviceFeedback,
      showRegistration: false,
    });
  });

  container.append(registrationSection, backButton, createStudentShareUtilityButton());
  elements.studentScreenForm.replaceChildren(container);
  elements.studentScreenForm.hidden = false;
  updateStudentShareBlock();
}

function openAddSetModal(initialView = "choice") {
  state.addSetModalView = initialView;
  document.body.classList.add("add-set-modal-open");
  elements.addSetModal.hidden = false;
  renderAddSetModalView();
}

function closeAddSetModal() {
  state.addSetModalView = "choice";
  delete elements.addSetModal.dataset.view;
  document.body.classList.remove("add-set-modal-open");
  elements.addSetModal.hidden = true;
  elements.addSetBody.replaceChildren();
  void stopAddSetScanner();
}

function handleAddSetModalOverlayClick(event) {
  if (event.target === elements.addSetModal) {
    closeAddSetModal();
  }
}

function handleStudentSetModalOverlayClick(event) {
  if (event.target === elements.studentSetModal || event.target.closest(".student-set-modal__backdrop")) {
    closeStudentSetModal();
  }
}

function handleDocumentClick(event) {
  if (event.target.closest(".student-screen__library-menu")) {
    return;
  }

  closeStudentSetMenus();
}

function closeStudentSetMenus(exceptMenu = null) {
  for (const menu of document.querySelectorAll(".student-screen__library-menu[open]")) {
    if (exceptMenu && menu === exceptMenu) {
      continue;
    }
    menu.open = false;
  }
}

function setAddSetModalView(view) {
  state.addSetModalView = view;
  renderAddSetModalView();
}

function renderAddSetModalView() {
  const container = document.createElement("div");
  container.className = "add-set-modal__view";
  container.dataset.view = state.addSetModalView;
  elements.addSetModal.dataset.view = state.addSetModalView;

  if (state.addSetModalView === "scanner") {
    container.append(createAddSetScannerView());
  } else if (state.addSetModalView === "link") {
    container.append(createAddSetLinkView());
  } else {
    container.append(createAddSetChoiceView());
  }

  elements.addSetBody.replaceChildren(container);
  requestAnimationFrame(() => {
    container.classList.add("is-entered");
    container.querySelector("[data-autofocus]")?.focus();
  });

  if (state.addSetModalView === "scanner") {
    void startAddSetScanner();
  } else {
    void stopAddSetScanner();
  }
}

function createAddSetChoiceView() {
  const section = document.createElement("section");
  section.className = "add-set-modal__section add-set-modal__section--choice";

  const title = document.createElement("h2");
  title.id = "add-set-title";
  title.className = "add-set-modal__title";
  title.textContent = "Lernset abonnieren";

  const actions = document.createElement("div");
  actions.className = "add-set-modal__choices";
  actions.append(
    createAddSetChoiceButton("QR", createAddSetQrIcon(), () => setAddSetModalView("scanner"), true),
    createAddSetChoiceButton("Link", createAddSetLinkIcon(), () => setAddSetModalView("link")),
  );

  section.append(title, actions);
  return section;
}

function createAddSetChoiceButton(label, iconNode, onClick, autoFocus = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-set-modal__choice";
  if (autoFocus) {
    button.dataset.autofocus = "true";
  }
  button.addEventListener("click", onClick);

  const iconWrap = document.createElement("span");
  iconWrap.className = "add-set-modal__choice-icon";
  iconWrap.append(iconNode);

  const text = document.createElement("span");
  text.className = "add-set-modal__choice-label";
  text.textContent = label;

  button.append(iconWrap, text);
  return button;
}

function createAddSetLinkView() {
  const section = document.createElement("section");
  section.className = "add-set-modal__section";

  const title = document.createElement("h2");
  title.id = "add-set-title";
  title.className = "add-set-modal__title";
  title.textContent = "Link";

  const form = document.createElement("form");
  form.className = "add-set-modal__form";
  form.noValidate = true;
  form.addEventListener("submit", handleAddSetLinkSubmit);

  const input = document.createElement("input");
  input.name = "manual-set-target";
  input.type = "text";
  input.className = "add-set-modal__input";
  input.setAttribute("aria-label", "Link");
  input.autocapitalize = "off";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "https://";
  input.dataset.autofocus = "true";

  const actions = document.createElement("div");
  actions.className = "add-set-modal__actions";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "add-set-modal__action add-set-modal__action--primary";
  submit.textContent = "Öffnen";

  const qr = document.createElement("button");
  qr.type = "button";
  qr.className = "add-set-modal__action add-set-modal__action--secondary";
  qr.textContent = "QR";
  qr.addEventListener("click", () => setAddSetModalView("scanner"));

  actions.append(submit, qr);
  form.append(input, actions);

  const feedback = document.createElement("p");
  feedback.id = "add-set-feedback";
  feedback.className = "add-set-modal__feedback";

  section.append(title, form, feedback);
  return section;
}

function createAddSetScannerView() {
  const section = document.createElement("section");
  section.className = "add-set-modal__section";

  const title = document.createElement("h2");
  title.id = "add-set-title";
  title.className = "add-set-modal__title";
  title.textContent = "QR";

  const scanner = document.createElement("div");
  scanner.id = "add-set-qr-region";
  scanner.className = "add-set-modal__scanner";

  const actions = document.createElement("div");
  actions.className = "add-set-modal__actions";

  const link = document.createElement("button");
  link.type = "button";
  link.className = "add-set-modal__action add-set-modal__action--secondary";
  link.textContent = "Link";
  link.dataset.autofocus = "true";
  link.addEventListener("click", () => setAddSetModalView("link"));

  const back = document.createElement("button");
  back.type = "button";
  back.className = "add-set-modal__action add-set-modal__action--ghost";
  back.textContent = "Zurück";
  back.addEventListener("click", () => setAddSetModalView("choice"));

  actions.append(link, back);

  const feedback = document.createElement("p");
  feedback.id = "add-set-feedback";
  feedback.className = "add-set-modal__feedback";

  section.append(title, scanner, actions, feedback);
  return section;
}

function getAddSetFeedbackElement() {
  return document.getElementById("add-set-feedback");
}

function setAddSetFeedback(message, isError = true) {
  const feedback = getAddSetFeedbackElement();
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.classList.toggle("is-success", Boolean(message) && !isError);
}

async function handleAddSetLinkSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const rawTarget = typeof formData.get("manual-set-target") === "string"
    ? formData.get("manual-set-target").trim()
    : "";
  const target = normalizeScannedSetTarget(rawTarget);

  if (!target.isValid) {
    setAddSetFeedback(target.error);
    return;
  }

  closeAddSetModal();
  window.location.assign(target.url);
}

async function startAddSetScanner() {
  await stopAddSetScanner();
  addSetScanHandled = false;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.Html5Qrcode) {
    setAddSetFeedback("Kamera nicht verfügbar.");
    return;
  }

  const scannerRegion = document.getElementById("add-set-qr-region");
  if (!scannerRegion) {
    return;
  }

  const scanner = new window.Html5Qrcode("add-set-qr-region");
  addSetScanner = scanner;

  const handleDecoded = (decodedText) => {
    if (addSetScanHandled) {
      return;
    }

    const target = normalizeScannedSetTarget(decodedText);
    if (!target.isValid) {
      setAddSetFeedback(target.error);
      return;
    }

    addSetScanHandled = true;
    closeAddSetModal();
    window.location.assign(target.url);
  };

  try {
    await scanner.start(
      { facingMode: { exact: "environment" } },
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1,
      },
      handleDecoded,
      () => {},
    );
  } catch (error) {
    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        handleDecoded,
        () => {},
      );
    } catch (fallbackError) {
      console.error("Unable to start QR scanner:", fallbackError);
      setAddSetFeedback("Kamera nicht verfügbar.");
    }
  }
}

async function stopAddSetScanner() {
  if (!addSetScanner) {
    return;
  }

  const scanner = addSetScanner;
  addSetScanner = null;

  try {
    await scanner.stop();
  } catch (_error) {}

  try {
    await scanner.clear();
  } catch (_error) {}
}

function createAddSetQrIcon() {
  return createAddSetIcon([
    ["rect", { x: "5", y: "5", width: "5", height: "5", rx: "1" }],
    ["rect", { x: "14", y: "5", width: "5", height: "5", rx: "1" }],
    ["rect", { x: "5", y: "14", width: "5", height: "5", rx: "1" }],
    ["path", { d: "M13 13h2v2h-2zm3 0h3v3h-2v1h-1zm-3 3h1v1h-1zm2 2h1v1h-1zm2-1h2v2h-2z" }],
  ]);
}

function createAddSetLinkIcon() {
  return createAddSetIcon([
    ["path", { d: "M10.5 14.5l3-3" }],
    ["path", { d: "M8.5 16.5l-1 1a3 3 0 104.2 4.2l2.3-2.3a3 3 0 000-4.2l-.5-.5" }],
    ["path", { d: "M15.5 8.5l1-1a3 3 0 10-4.2-4.2L10 5.6a3 3 0 000 4.2l.5.5" }],
  ]);
}

function createAddSetIcon(shapes) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, value);
    }
    svg.append(node);
  }

  return svg;
}

function buildStudentShareUrlForSetPath(setPath) {
  const origin = state.publicOrigin || window.location.origin;
  const currentUrl = new URL(window.location.href);
  const shareUrl = new URL(currentUrl.pathname || "/index.html", `${origin}/`);
  shareUrl.search = "";
  shareUrl.hash = "";
  shareUrl.searchParams.set("set", setPath);
  return shareUrl.href;
}

function openStudentSetShareModal(subscription) {
  state.studentSetModalMode = "share";
  state.activeStudentSetPath = subscription.setPath;
  state.activeStudentSetTitle = subscription.title === subscription.setPath
    ? (subscription.id || "Lernset")
    : subscription.title;
  state.activeStudentSetShareUrl = buildStudentShareUrlForSetPath(subscription.setPath);
  renderStudentSetModalBody();
  elements.studentSetModal.hidden = false;
}

function openStudentSetConfirmModal(subscription) {
  state.studentSetModalMode = "confirm-unsubscribe";
  state.activeStudentSetPath = subscription.setPath;
  state.activeStudentSetTitle = subscription.title === subscription.setPath
    ? (subscription.id || "Lernset")
    : subscription.title;
  state.activeStudentSetShareUrl = "";
  renderStudentSetModalBody();
  elements.studentSetModal.hidden = false;
}

function closeStudentSetModal() {
  state.studentSetModalMode = "";
  state.activeStudentSetPath = "";
  state.activeStudentSetTitle = "";
  state.activeStudentSetShareUrl = "";
  elements.studentSetModal.hidden = true;
  elements.studentSetModalBody.replaceChildren();
}

function renderStudentSetModalBody() {
  const body = document.createElement("div");
  body.className = "student-set-panel__body";

  if (state.studentSetModalMode === "share") {
    const title = document.createElement("h2");
    title.className = "student-set-panel__title";
    title.textContent = state.activeStudentSetTitle;

    const qrShell = document.createElement("div");
    qrShell.className = "student-set-panel__qr-shell";

    const qrFrame = document.createElement("div");
    qrFrame.className = "student-set-panel__qr-frame";

    const qrCanvas = document.createElement("canvas");
    qrCanvas.className = "student-set-panel__qr";
    qrCanvas.width = 220;
    qrCanvas.height = 220;
    qrFrame.append(qrCanvas);
    qrShell.append(qrFrame);

    const linkRow = document.createElement("div");
    linkRow.className = "student-set-panel__link-row";

    const linkText = document.createElement("span");
    linkText.className = "student-set-panel__link";
    linkText.textContent = state.activeStudentSetShareUrl;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "student-set-panel__copy";
    copyButton.setAttribute("aria-label", "Link kopieren");
    copyButton.innerHTML = '<span class="student-set-panel__copy-icon" aria-hidden="true"></span>';
    copyButton.addEventListener("click", handleStudentSetShareCopy);

    const feedback = document.createElement("span");
    feedback.id = "student-set-modal-feedback";
    feedback.className = "student-set-panel__feedback";
    feedback.setAttribute("aria-live", "polite");

    linkRow.append(linkText, copyButton, feedback);
    body.append(title, qrShell, linkRow);

    requestAnimationFrame(() => {
      renderQrIntoCanvas(qrCanvas, state.activeStudentSetShareUrl, {
        foreground: "#1f1f1f",
      });
    });
  } else if (state.studentSetModalMode === "confirm-unsubscribe") {
    const title = document.createElement("h2");
    title.className = "student-set-panel__title";
    title.textContent = "Abo beenden?";

    const message = document.createElement("p");
    message.className = "student-set-panel__message";
    message.textContent = "Dabei gehen Lernstände, Übungsdaten und spätere Highscores für dieses Lernset verloren.";

    const hint = document.createElement("p");
    hint.className = "student-set-panel__hint";
    hint.textContent = "Ein neues Abo startet wieder mit einem neuen Speicherstand.";

    const actions = document.createElement("div");
    actions.className = "student-set-panel__actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "student-set-panel__action student-set-panel__action--secondary";
    cancelButton.textContent = "Abbrechen";
    cancelButton.addEventListener("click", closeStudentSetModal);

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "student-set-panel__action student-set-panel__action--danger";
    confirmButton.textContent = "Abo beenden";
    confirmButton.addEventListener("click", () => {
      void confirmStudentSetUnsubscribe();
    });

    actions.append(cancelButton, confirmButton);
    body.append(title, message, hint, actions);
  }

  elements.studentSetModalBody.replaceChildren(body);
}

async function handleStudentSetShareCopy() {
  if (!state.activeStudentSetShareUrl) {
    return;
  }

  const feedback = document.getElementById("student-set-modal-feedback");

  try {
    await navigator.clipboard.writeText(state.activeStudentSetShareUrl);
    if (feedback) {
      feedback.textContent = "Kopiert.";
      feedback.classList.add("is-success");
    }
  } catch (_error) {
    if (feedback) {
      feedback.textContent = "Fehler.";
      feedback.classList.remove("is-success");
    }
  }
}

async function confirmStudentSetUnsubscribe() {
  const setPath = state.activeStudentSetPath;
  closeStudentSetModal();
  if (!setPath) {
    return;
  }
  await handleRemoveSubscribedSet(setPath);
}

function renderRegistrationState({
  selectedTabletId = DEFAULT_TABLET_ID,
  feedback = "",
  detail = "Wähle das Tablet und setze einen PIN.",
} = {}) {
  void detail;
  state.accessUseAlternate = true;
  renderAccessState({
    registrationTabletId: selectedTabletId,
    registrationFeedback: feedback,
    showRegistration: true,
  });
}

function renderPinState(tabletId, {
  feedback = "",
  title = "PIN eingeben",
  message = `Tablet: ${getTabletLabel(tabletId)}`,
  detail = "Gib den PIN für dieses Tablet ein.",
  submitLabel = "Entsperren und starten",
} = {}) {
  void title;
  void message;
  void detail;
  void submitLabel;
  renderAccessState({
    loginTabletId: tabletId,
    loginFeedback: feedback,
    showRegistration: false,
  });
}

async function renderStudentHome(tabletId, {
  feedback = "",
  feedbackIsError = false,
  highlightedSetPath = "",
  highlightedSetLabel = "",
} = {}) {
  renderStudentScreen({
    mode: APP_MODES.HOME,
    title: "Lernsets",
    message: createDeviceContextRow(tabletId),
    detail: "",
    kicker: "Menü",
    secondaryAction: "clear-local-tablet",
    secondaryLabel: "Anderes Tablet wählen",
  });

  const result = await loadTabletSubscriptions(tabletId);

  if (result.status === 409) {
    clearLocalTabletId();
    clearStudentSessionUnlock();
    clearTabletSession();
    clearActiveTabletContext();
    resetTabletDirectoryCache();
    await ensureTabletDirectoryLoaded();
    renderAccessState({
      loginTabletId: "",
      registrationTabletId: tabletId,
      registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Lernsets und ohne Lernstände.",
      showRegistration: true,
    });
    return;
  }

  if (result.status === 401 || result.status === 403) {
    return;
  }

  if (!result.ok) {
    renderStudentLoadErrorState({
      title: "Set-Menü nicht verfügbar",
      message: "Sets konnten nicht geladen werden.",
      detail: result.error,
      primaryAction: "go-home",
      primaryLabel: "Erneut",
      secondaryAction: "clear-local-tablet",
      secondaryLabel: "Anderes Tablet wählen",
    });
    return;
  }

  state.subscriptions = result.subscriptions;

  const container = document.createElement("div");
  container.className = "student-screen__home";

  const layout = document.createElement("div");
  layout.className = "student-screen__home-layout";

  const main = document.createElement("section");
  main.className = "student-screen__home-main";

  const aside = document.createElement("aside");
  aside.className = "student-screen__home-aside";

  const library = document.createElement("div");
  library.className = "student-screen__library";
  library.classList.toggle("student-screen__library--single-column", state.subscriptions.length <= 1);

  const summary = buildSubscriptionSummary(state.subscriptions);

  const collectionHeader = document.createElement("div");
  collectionHeader.className = "student-screen__home-collection";

  const collectionTitle = document.createElement("h2");
  collectionTitle.className = "student-screen__home-heading";
  collectionTitle.textContent = state.subscriptions.length > 0 ? "Deine Lernsets" : "Noch keine Lernsets";

  const collectionMeta = document.createElement("p");
  collectionMeta.className = "student-screen__home-subheading";
  collectionMeta.textContent = state.subscriptions.length > 0
    ? `${summary.setCount} Sets · ${summary.cardCount} Karten`
    : "QR-Code oder Link verwenden, um das erste Set zu abonnieren.";

  collectionHeader.append(collectionTitle, collectionMeta);

  if (feedback) {
    const feedbackElement = createStudentFeedback(feedback);
    if (!feedbackIsError) {
      feedbackElement.classList.add("is-success");
    }
    main.append(feedbackElement);
  }

  main.append(collectionHeader);

  if (state.subscriptions.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "student-screen__empty";

    const emptyTitle = document.createElement("p");
    emptyTitle.className = "student-screen__empty-title";
    emptyTitle.textContent = "Noch keine Abos";

    const emptyMessage = document.createElement("p");
    emptyMessage.className = "student-screen__empty-message";
    emptyMessage.textContent = "Neue Inhalte erscheinen hier, sobald ein Set auf diesem Tablet freigeschaltet wurde.";

    emptyState.append(emptyTitle, emptyMessage);
    main.append(emptyState);
  } else {
    for (const subscription of state.subscriptions) {
      library.append(createStudentSetRow(subscription, {
        isHighlighted: subscription?.setPath === highlightedSetPath,
        highlightLabel: subscription?.setPath === highlightedSetPath ? highlightedSetLabel : "",
      }));
    }
  }

  main.append(library);
  aside.append(
    createStudentHomeTabletCard(tabletId, summary),
    createStudentHomeAddCard(),
    createStudentHomeHintCard(summary),
  );

  layout.append(main, aside);
  container.append(layout);

  elements.studentScreenForm.replaceChildren(container);
  elements.studentScreenForm.hidden = false;
}

function buildSubscriptionSummary(subscriptions) {
  const setCount = subscriptions.length;
  const cardCount = subscriptions.reduce((total, subscription) => (
    total + (Number.isFinite(subscription?.cardCount) ? subscription.cardCount : 0)
  ), 0);
  const categoryCount = new Set(
    subscriptions
      .map((subscription) => typeof subscription?.category === "string" ? subscription.category.trim() : "")
      .filter(Boolean),
  ).size;

  return {
    setCount,
    cardCount,
    categoryCount,
  };
}

function createStudentHomeTabletCard(tabletId, summary) {
  const card = document.createElement("section");
  card.className = "student-screen__home-card student-screen__home-card--tablet";

  const title = document.createElement("h2");
  title.className = "student-screen__home-card-title";
  title.textContent = "Aktives Tablet";

  const text = document.createElement("p");
  text.className = "student-screen__home-card-text";
  text.textContent = "Dieses Gerät ist aktuell für deine Lernsets angemeldet.";

  const metrics = document.createElement("div");
  metrics.className = "student-screen__home-metrics";
  metrics.append(
    createStudentHomeMetric(summary.setCount, "Sets"),
    createStudentHomeMetric(summary.cardCount, "Karten"),
    createStudentHomeMetric(summary.categoryCount, "Themen"),
  );

  card.append(
    title,
    text,
    createTabletCard(getTabletMeta(tabletId), {
      interactive: false,
      selected: true,
      statusText: "Aktiv",
    }),
    metrics,
  );
  return card;
}

function createStudentHomeMetric(value, label) {
  const metric = document.createElement("div");
  metric.className = "student-screen__home-metric";

  const valueElement = document.createElement("strong");
  valueElement.className = "student-screen__home-metric-value";
  valueElement.textContent = String(value);

  const labelElement = document.createElement("span");
  labelElement.className = "student-screen__home-metric-label";
  labelElement.textContent = label;

  metric.append(valueElement, labelElement);
  return metric;
}

function createStudentHomeAddCard() {
  const wrapper = document.createElement("div");
  wrapper.className = "student-screen__home-quick-add";
  wrapper.append(createStudentAddSetCard());
  return wrapper;
}

function createStudentHomeHintCard(summary) {
  const card = document.createElement("section");
  card.className = "student-screen__home-card student-screen__home-card--hint";

  const title = document.createElement("h2");
  title.className = "student-screen__home-card-title";
  title.textContent = "Schnell orientiert";

  const text = document.createElement("p");
  text.className = "student-screen__home-card-text";
  text.textContent = summary.setCount > 0
    ? "Starte links ein Set oder füge rechts per QR-Code oder Link neues Material hinzu."
    : "Nutze rechts den Abo-Button, um per QR-Code oder Link dein erstes Lernset hinzuzufügen.";

  card.append(title, text);
  return card;
}

function renderStudentLoadErrorState({
  title,
  message,
  detail,
  primaryAction = "",
  primaryLabel = "",
  secondaryAction = "",
  secondaryLabel = "",
}) {
  renderStudentScreen({
    mode: APP_MODES.LOAD_ERROR,
    title,
    message,
    detail,
    kicker: "Set",
    primaryAction,
    primaryLabel,
    secondaryAction,
    secondaryLabel,
  });
}

function handleStudentScreenPrimaryAction() {
  executeStudentScreenAction(state.screenPrimaryAction);
}

function handleStudentScreenSecondaryAction() {
  executeStudentScreenAction(state.screenSecondaryAction);
}

function executeStudentScreenAction(action) {
  if (action === "retry-set") {
    initializeStudentApp();
    return;
  }

  if (action === "go-home") {
    state.requestedSetPath = "";
    state.requestedSetUrl = "";
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("set");
    window.history.replaceState({}, "", nextUrl);
    void continueStudentAccessFlow();
    return;
  }

  if (action === "clear-set") {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("set");
    window.history.replaceState({}, "", nextUrl);
    initializeStudentApp();
    return;
  }

  if (action === "clear-local-tablet") {
    clearLocalTabletId();
    clearStudentSessionUnlock();
    clearTabletSession();
    clearActiveTabletContext();
    void continueStudentAccessFlow();
    return;
  }

  if (action === "open-add-set") {
    renderScannerPlaceholderState({
      allowHomeReturn: true,
    });
    return;
  }
}

async function handleReturnToStudentHome() {
  state.requestedSetPath = "";
  state.requestedSetUrl = "";
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("set");
  window.history.replaceState({}, "", nextUrl);

  await continueStudentAccessFlow();
}

function getScannerFeedbackElement() {
  return document.getElementById("student-scanner-feedback");
}

function setScannerFeedback(message, isError = true) {
  const feedback = getScannerFeedbackElement();

  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.classList.toggle("is-success", Boolean(message) && !isError);
}

async function handleManualSetSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const rawTarget = typeof formData.get("manual-set-target") === "string"
    ? formData.get("manual-set-target").trim()
    : "";

  const target = normalizeScannedSetTarget(rawTarget);

  if (!target.isValid) {
    setScannerFeedback(target.error);
    return;
  }

  setScannerFeedback("Öffne Set.", false);
  window.location.assign(target.url);
}

function normalizeScannedSetTarget(rawValue) {
  const trimmedValue = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!trimmedValue) {
    return {
      isValid: false,
      url: "",
      setPath: "",
      error: "Link oder Pfad eingeben.",
    };
  }

  const directSetPath = normalizeSetPath(trimmedValue);

  if (directSetPath) {
    return {
      isValid: true,
      setPath: directSetPath,
      url: buildCanonicalStudentSetUrl(directSetPath),
      error: "",
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(trimmedValue, window.location.href);
  } catch (error) {
    return {
      isValid: false,
      url: "",
      setPath: "",
      error: "Ungültiger Link.",
    };
  }

  if (parsedUrl.origin !== window.location.origin) {
    return {
      isValid: false,
      url: "",
      setPath: "",
      error: "Nur Links dieser App sind erlaubt.",
    };
  }

  const normalizedSetPath = normalizeSetPath(parsedUrl.searchParams.get("set"));

  if (!normalizedSetPath) {
    return {
      isValid: false,
      url: "",
      setPath: "",
      error: "Kein gültiges Set gefunden.",
    };
  }

  return {
    isValid: true,
    setPath: normalizedSetPath,
    url: buildCanonicalStudentSetUrl(normalizedSetPath),
    error: "",
  };
}

function normalizeSetPath(value) {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return "";
  }

  const normalizedValue = rawValue.startsWith("./") ? rawValue.slice(2) : rawValue;

  if (
    !normalizedValue.endsWith(".json")
    || normalizedValue.startsWith("/")
    || normalizedValue.includes("\\")
    || normalizedValue.includes("?")
    || normalizedValue.includes("#")
    || !normalizedValue.startsWith("sets/")
  ) {
    return "";
  }

  const pathSegments = normalizedValue.split("/");

  if (pathSegments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return "";
  }

  return normalizedValue;
}

function buildCanonicalStudentSetUrl(setPath) {
  const url = new URL("index.html", getAppBaseUrl());
  url.searchParams.set("set", setPath);
  return url.href;
}

function createStudentField({ label, control }) {
  const wrapper = document.createElement("label");
  wrapper.className = "student-screen__field";

  const labelElement = document.createElement("span");
  labelElement.className = "student-screen__label";
  labelElement.textContent = label;

  wrapper.append(labelElement, control);
  return wrapper;
}

function createHiddenInput(name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

function createTabletPicker(name, selectedTabletId = "", {
  tablets = getAvailableTablets(),
  emptyStateText = "Keine Tablets verfügbar.",
  preferFirstAvailable = true,
  collapseWhenSelected = false,
  allowEmptySelection = false,
} = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "student-screen__device-picker";

  const resolvedSelection = resolveTabletSelection(selectedTabletId, {
    tablets,
    preferFirstAvailable,
  });

  const hiddenInput = createHiddenInput(name, resolvedSelection);
  hiddenInput.required = true;
  wrapper.append(hiddenInput);

  if (tablets.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "student-screen__device-empty";
    emptyState.textContent = emptyStateText;
    wrapper.append(emptyState);
    return wrapper;
  }

  const grid = document.createElement("div");
  grid.className = "student-screen__device-grid";
  grid.hidden = collapseWhenSelected && Boolean(resolvedSelection);

  const buttons = [];
  let selectedSummary = null;
  let selectedPillLabel = null;

  const setGridVisible = (isVisible) => {
    grid.hidden = !isVisible;
    wrapper.classList.toggle("is-choosing", isVisible);
  };

  const syncSelectedSummary = (nextTabletId) => {
    if (!selectedSummary || !selectedPillLabel) {
      return;
    }

    const selectedPill = selectedSummary.querySelector(".device-pill");

    if (!nextTabletId) {
      selectedSummary.hidden = true;
      selectedPillLabel.textContent = "";
      return;
    }

    if (selectedPill) {
      selectedPill.dataset.tabletGroup = getTabletGroupName(getTabletLabel(nextTabletId));
    }
    selectedPillLabel.textContent = getTabletLabel(nextTabletId);
    selectedSummary.hidden = false;
  };

  const updateSelection = (nextTabletId) => {
    hiddenInput.value = nextTabletId;

    for (const button of buttons) {
      const isSelected = button.dataset.tabletId === nextTabletId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }

    syncSelectedSummary(nextTabletId);

    if (collapseWhenSelected) {
      setGridVisible(!nextTabletId);
    }
  };

  if (collapseWhenSelected) {
    selectedSummary = document.createElement("div");
    selectedSummary.className = "student-screen__device-selection";
    selectedSummary.hidden = !resolvedSelection;

    const selectedPill = document.createElement("div");
    selectedPill.className = "device-pill device-pill--selected";
    selectedPill.dataset.tabletGroup = getTabletGroupName(getTabletLabel(resolvedSelection || DEFAULT_TABLET_ID));

    const icon = document.createElement("img");
    icon.className = "device-pill__icon";
    icon.src = TABLET_ICON_PATH;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    selectedPillLabel = document.createElement("span");
    selectedPillLabel.className = "device-pill__label";
    selectedPillLabel.textContent = resolvedSelection ? getTabletLabel(resolvedSelection) : "";

    selectedPill.append(icon, selectedPillLabel);
    selectedSummary.append(selectedPill);

    if (allowEmptySelection) {
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "student-screen__device-selection-clear";
      clearButton.setAttribute("aria-label", "Tablet-Auswahl entfernen");
      clearButton.textContent = "×";
      clearButton.addEventListener("click", () => {
        updateSelection("");
        window.requestAnimationFrame(() => {
          const firstButton = grid.querySelector(".student-screen__device-option");
          if (firstButton instanceof HTMLElement) {
            firstButton.focus();
          }
        });
      });
      selectedSummary.append(clearButton);
    }

    wrapper.append(selectedSummary);
  }

  for (const tablet of tablets) {
    const button = createTabletOption(tablet, {
      selected: tablet.id === resolvedSelection,
    });
    button.type = "button";
    button.dataset.tabletId = tablet.id;
    button.addEventListener("click", () => {
      updateSelection(tablet.id);
    });
    buttons.push(button);
    grid.append(button);
  }

  wrapper.append(grid);
  return wrapper;
}

function createTabletOption(tablet, { selected = false } = {}) {
  const button = document.createElement("button");
  button.className = "student-screen__device-option";
  button.dataset.tabletGroup = getTabletGroupName(tablet.label || tablet.id);
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  button.setAttribute("aria-label", tablet.label || formatTabletLabel(tablet.id));
  button.append(createDevicePill(tablet, {
    className: "device-pill--compact",
  }));
  return button;
}

function createTabletCard(tablet, {
  interactive = false,
  selected = false,
  statusText = "Tablet",
} = {}) {
  const element = document.createElement(interactive ? "button" : "div");
  element.className = "student-screen__device-card";
  element.dataset.tabletGroup = getTabletGroupName(tablet.label || tablet.id);
  element.classList.toggle("is-selected", selected);

  if (interactive) {
    element.setAttribute("aria-pressed", selected ? "true" : "false");
    element.setAttribute("aria-label", tablet.label || formatTabletLabel(tablet.id));
  } else {
    element.classList.add("student-screen__device-card--static");
  }

  const iconShell = document.createElement("span");
  iconShell.className = "student-screen__device-icon-shell";

  const icon = document.createElement("img");
  icon.className = "student-screen__device-icon";
  icon.src = TABLET_ICON_PATH;
  icon.alt = "";
  icon.decoding = "async";

  const copy = document.createElement("span");
  copy.className = "student-screen__device-copy";

  const eyebrow = document.createElement("span");
  eyebrow.className = "student-screen__device-eyebrow";
  eyebrow.textContent = "Tablet";

  const tagRow = document.createElement("span");
  tagRow.className = "student-screen__device-tag-row";

  const tag = document.createElement("span");
  tag.className = "student-screen__device-tag";
  tag.textContent = tablet.label || formatTabletLabel(tablet.id);

  const status = document.createElement("span");
  status.className = "student-screen__device-status";
  status.textContent = statusText;

  iconShell.append(icon);
  tagRow.append(tag, status);
  copy.append(eyebrow, tagRow);
  element.append(iconShell, copy);
  return element;
}

function normalizeTabletIdInput(value) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  const defaultLabel = DEFAULT_TABLET_LABEL.trim().toLowerCase().replace(/\s+/g, "-");
  return normalized === defaultLabel ? DEFAULT_TABLET_ID : normalized;
}

function createPinInput(name, placeholder) {
  const input = document.createElement("input");
  input.name = name;
  input.type = "password";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.enterKeyHint = "go";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.className = "student-screen__input";
  input.placeholder = placeholder;
  input.required = true;
  return input;
}

function createStudentSubmitButton(label) {
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "student-screen__submit";
  button.textContent = label;
  return button;
}

function createStudentFeedback(message) {
  const feedback = document.createElement("p");
  feedback.className = "student-screen__feedback";
  feedback.textContent = message;
  return feedback;
}

async function ensureTabletDirectoryLoaded() {
  if (state.availableTablets.length) {
    return state.availableTablets;
  }

  if (tabletDirectoryPromise) {
    return tabletDirectoryPromise;
  }

  tabletDirectoryPromise = (async () => {
    try {
      const response = await apiRequest(TABLET_DIRECTORY_API_PATH);
      const tablets = normalizeTabletDirectory(response?.data?.tablets);
      state.availableTablets = tablets.length ? tablets : getFallbackTabletDirectory();
    } catch (error) {
      console.error("Unable to load tablet directory:", error);
      state.availableTablets = getFallbackTabletDirectory();
    } finally {
      tabletDirectoryPromise = null;
    }

    return state.availableTablets;
  })();

  return tabletDirectoryPromise;
}

function normalizeTabletDirectory(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => normalizeTabletMeta(entry))
    .filter(Boolean)
    .sort((left, right) =>
      left.label.localeCompare(right.label, "de", {
        numeric: true,
        sensitivity: "base",
      }));
}

function normalizeTabletMeta(entry) {
  const id = typeof entry?.id === "string" ? entry.id.trim() : "";
  const label = typeof entry?.label === "string" ? entry.label.trim() : "";

  if (!id) {
    return null;
  }

  return {
    id,
    label: label || formatTabletLabel(id),
    registered: Boolean(entry?.registered),
    pairingId: typeof entry?.pairingId === "string" ? entry.pairingId.trim() : "",
    subscriptions: Array.isArray(entry?.subscriptions) ? entry.subscriptions : [],
    isCoupled: Boolean(entry?.isCoupled),
    isLocked: Boolean(entry?.isLocked),
  };
}

function getFallbackTabletDirectory() {
  return [{
    id: DEFAULT_TABLET_ID,
    label: DEFAULT_TABLET_LABEL,
    registered: true,
    pairingId: "",
    subscriptions: [],
    isCoupled: true,
    isLocked: false,
  }];
}

function getAvailableTablets({ registered } = {}) {
  const tablets = state.availableTablets.length
    ? state.availableTablets
    : getFallbackTabletDirectory();

  if (typeof registered === "boolean") {
    return tablets.filter((tablet) => tablet.registered === registered);
  }

  return tablets;
}

function getRegistrationTablets() {
  return getAvailableTablets({ registered: false });
}

function getLoginTablets() {
  return getAvailableTablets({ registered: true });
}

function resolveTabletSelection(preferredTabletId = "", {
  tablets = getAvailableTablets(),
  preferFirstAvailable = false,
} = {}) {
  const preferredExists = tablets.some((tablet) => tablet.id === preferredTabletId);

  if (preferredTabletId && preferredExists) {
    return preferredTabletId;
  }

  if (preferFirstAvailable && tablets.length > 0) {
    return tablets[0].id;
  }

  return "";
}

function getTabletMeta(tabletId) {
  if (!tabletId) {
    return {
      id: DEFAULT_TABLET_ID,
      label: DEFAULT_TABLET_LABEL,
      registered: true,
      pairingId: "",
      subscriptions: [],
      isCoupled: true,
      isLocked: false,
    };
  }

  const match = getAvailableTablets().find((tablet) => tablet.id === tabletId);

  if (match) {
    return match;
  }

  return {
    id: tabletId,
    label: formatTabletLabel(tabletId),
    registered: false,
    pairingId: "",
    subscriptions: [],
    isCoupled: false,
    isLocked: false,
  };
}

function formatTabletLabel(tabletId) {
  return tabletId
    .trim()
    .split("-")
    .filter(Boolean)
    .map((part) => (/^[0-9]+$/.test(part) ? part : `${part[0]?.toUpperCase() || ""}${part.slice(1)}`))
    .join(" ");
}

function getTabletGroupName(value) {
  return value
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function createStudentSetRow(subscription, {
  isHighlighted = false,
  highlightLabel = "",
} = {}) {
  const row = document.createElement("article");
  row.className = "student-screen__library-card";
  row.classList.toggle("is-highlighted", isHighlighted);

  const cover = document.createElement("div");
  cover.className = "student-screen__library-cover";

  const badge = document.createElement("span");
  badge.className = "student-screen__library-badge";
  badge.textContent = subscription.category || "Lernset";

  const coverMark = document.createElement("span");
  coverMark.className = "student-screen__library-mark";
  coverMark.textContent = getSetCoverMark(subscription);

  const coverHeader = document.createElement("div");
  coverHeader.className = "student-screen__library-cover-header";
  coverHeader.append(badge);

  if (isHighlighted && highlightLabel) {
    const highlight = document.createElement("span");
    highlight.className = "student-screen__library-highlight";
    highlight.textContent = highlightLabel;
    coverHeader.append(highlight);
  }

  cover.append(coverHeader, coverMark);

  const copy = document.createElement("div");
  copy.className = "student-screen__library-copy";

  const title = document.createElement("h3");
  title.className = "student-screen__library-title";
  title.textContent = subscription.title === subscription.setPath
    ? (subscription.id || "Set")
    : subscription.title;

  const meta = document.createElement("p");
  meta.className = "student-screen__library-meta";
  meta.textContent = [
    Number.isFinite(subscription.cardCount) ? `${subscription.cardCount} Karten` : "",
    subscription.description || "",
  ].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "student-screen__library-actions";

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "student-screen__library-action";
  startButton.textContent = "Starten";
  startButton.addEventListener("click", () => {
    void handleStartSubscribedSet(subscription.setPath);
  });

  const menu = document.createElement("details");
  menu.className = "student-screen__library-menu";
  menu.addEventListener("toggle", () => {
    if (menu.open) {
      closeStudentSetMenus(menu);
    }
  });

  const summary = document.createElement("summary");
  summary.className = "student-screen__library-menu-toggle";
  summary.setAttribute("aria-label", "Mehr");

  const summaryIcon = document.createElement("span");
  summaryIcon.className = "material-symbols-outlined";
  summaryIcon.setAttribute("aria-hidden", "true");
  summaryIcon.textContent = "more_horiz";
  summary.append(summaryIcon);

  const menuPanel = document.createElement("div");
  menuPanel.className = "student-screen__library-menu-panel";

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.className = "student-screen__library-menu-action";
  shareButton.textContent = "Teilen";
  shareButton.addEventListener("click", () => {
    menu.open = false;
    openStudentSetShareModal(subscription);
  });

  const unsubscribeButton = document.createElement("button");
  unsubscribeButton.type = "button";
  unsubscribeButton.className = "student-screen__library-menu-action student-screen__library-menu-action--danger";
  unsubscribeButton.textContent = "Abo beenden";
  unsubscribeButton.addEventListener("click", () => {
    menu.open = false;
    openStudentSetConfirmModal(subscription);
  });

  menuPanel.append(shareButton, unsubscribeButton);
  menu.append(summary, menuPanel);

  actions.append(startButton, menu);
  copy.append(title, meta);
  row.append(cover, copy, actions);
  return row;
}

function createStudentAddSetCard() {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "student-screen__library-add";
  card.addEventListener("click", () => {
    renderScannerPlaceholderState({
      allowHomeReturn: true,
    });
  });

  const iconWrap = document.createElement("span");
  iconWrap.className = "student-screen__library-add-icon";

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.textContent = "qr_code_scanner";
  iconWrap.append(icon);

  const title = document.createElement("span");
  title.className = "student-screen__library-add-title";
  title.textContent = "Lernset abonnieren";

  const text = document.createElement("span");
  text.className = "student-screen__library-add-text";
  text.textContent = "QR oder Link";

  card.append(iconWrap, title, text);
  return card;
}

function getSetCoverMark(subscription) {
  const title = typeof subscription?.title === "string" ? subscription.title.trim() : "";

  if (!title) {
    return "SET";
  }

  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getTabletLabel(tabletId) {
  return getTabletMeta(tabletId).label;
}

async function handleStartSubscribedSet(setPath) {
  const tabletId = loadLocalTabletId();

  if (!tabletId) {
    clearStudentSessionUnlock();
    clearTabletSession();
    await continueStudentAccessFlow();
    return;
  }

  openLaunchModeModal(setPath);
}

function openLaunchModeModal(setPath) {
  const subscription = state.subscriptions.find((entry) => entry?.setPath === setPath);
  state.pendingLaunchSetPath = setPath;
  state.pendingLaunchSetTitle = subscription?.title || setPath;
  elements.launchModeTitle.textContent = state.pendingLaunchSetTitle;
  elements.launchModeModal.hidden = false;
  elements.launchModeStart.focus();
}

function closeLaunchModeModal() {
  state.pendingLaunchSetPath = "";
  state.pendingLaunchSetTitle = "";
  elements.launchModeModal.hidden = true;
}

function handleLaunchModeOverlayClick(event) {
  if (event.target === elements.launchModeModal) {
    closeLaunchModeModal();
  }
}

async function handleLaunchModeStart() {
  if (!state.pendingLaunchSetPath) {
    closeLaunchModeModal();
    return;
  }

  const setPath = state.pendingLaunchSetPath;
  closeLaunchModeModal();
  state.requestedSetPath = setPath;
  state.requestedSetUrl = new URL(setPath, getAppBaseUrl()).href;
  window.history.replaceState({}, "", buildCanonicalStudentSetUrl(setPath));
  await startFlashcardSet(setPath, new URL(setPath, getAppBaseUrl()).href);
}

async function handleRemoveSubscribedSet(setPath) {
  const tabletId = loadLocalTabletId();

  if (!tabletId) {
    clearStudentSessionUnlock();
    clearTabletSession();
    await continueStudentAccessFlow();
    return;
  }

  const result = await removeTabletSubscription(tabletId, setPath);

  if (result.authRequired) {
    return;
  }

  await renderStudentHome(tabletId, {
    feedback: result.ok ? "Abo beendet." : result.error,
    feedbackIsError: !result.ok,
  });
}

function loadLocalTabletId() {
  const value = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  return typeof value === "string" ? value.trim() : "";
}

function persistLocalTabletId(tabletId) {
  window.localStorage.setItem(DEVICE_STORAGE_KEY, tabletId);
}

function clearLocalTabletId() {
  window.localStorage.removeItem(DEVICE_STORAGE_KEY);
}

function loadTabletSession(tabletId = loadLocalTabletId()) {
  try {
    const rawValue = window.sessionStorage.getItem(TABLET_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const sessionTabletId = typeof parsed?.tabletId === "string" ? parsed.tabletId.trim() : "";
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";

    if (!sessionTabletId || !token || sessionTabletId !== tabletId) {
      return null;
    }

    return {
      tabletId: sessionTabletId,
      token,
    };
  } catch (error) {
    console.error("Unable to load tablet session:", error);
    return null;
  }
}

function hasTabletSessionToken(tabletId = loadLocalTabletId()) {
  return Boolean(loadTabletSession(tabletId)?.token);
}

function persistTabletSession(tabletId, token) {
  if (!tabletId || !token) {
    clearTabletSession();
    return;
  }

  window.sessionStorage.setItem(TABLET_SESSION_STORAGE_KEY, JSON.stringify({
    tabletId,
    token,
  }));
}

function clearTabletSession() {
  window.sessionStorage.removeItem(TABLET_SESSION_STORAGE_KEY);
}

function hasUnlockedStudentSession() {
  return window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
}

function persistStudentSessionUnlock() {
  window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
}

function clearStudentSessionUnlock() {
  window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
}

async function loadTabletSubscriptions(tabletId) {
  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/subscriptions`, {
      auth: "tablet",
      tabletId,
    });

    if (response.status === 401 || response.status === 403) {
      await handleExpiredTabletSession(tabletId);
      return {
        ok: false,
        status: response.status,
        tablet: null,
        subscriptions: [],
        error: getApiErrorMessage(response, "Sitzung abgelaufen. Bitte erneut mit PIN anmelden."),
      };
    }

    if (!response.ok) {
      syncActiveTabletContext(response.data?.tablet || null);
      return {
        ok: false,
        status: response.status,
        tablet: response.data?.tablet || null,
        subscriptions: [],
        error: getApiErrorMessage(response, "Set-Liste konnte nicht geladen werden."),
      };
    }

    syncActiveTabletContext(response.data?.tablet || null);

    return {
      ok: true,
      status: response.status,
      tablet: response.data?.tablet || null,
      subscriptions: Array.isArray(response.data?.subscriptions) ? response.data.subscriptions : [],
      error: "",
    };
  } catch (error) {
    console.error("Unable to load subscriptions:", error);
    return {
      ok: false,
      status: 0,
      tablet: null,
      subscriptions: [],
      error: "Server nicht erreichbar. Bitte erneut versuchen.",
    };
  }
}

async function getRequestedSetIntent(tabletId, setPath) {
  const result = await loadTabletSubscriptions(tabletId);

  if (result.status === 409) {
    return {
      isSubscribed: false,
      requiresRegistration: true,
      authRequired: false,
    };
  }

  if (result.status === 401 || result.status === 403) {
    return {
      isSubscribed: false,
      requiresRegistration: false,
      authRequired: true,
    };
  }

  if (!result.ok) {
    return {
      isSubscribed: false,
      requiresRegistration: false,
      authRequired: false,
    };
  }

  return {
    isSubscribed: result.subscriptions.some((entry) => entry?.setPath === setPath),
    requiresRegistration: false,
    authRequired: false,
  };
}

async function subscribeTabletToSet(tabletId, setPath) {
  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/subscriptions`, {
      auth: "tablet",
      tabletId,
      method: "POST",
      body: {
        setPath,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await handleExpiredTabletSession(tabletId);
        return {
          ok: false,
          authRequired: true,
          error: getApiErrorMessage(response, "Sitzung abgelaufen. Bitte erneut mit PIN anmelden."),
        };
      }

      return {
        ok: false,
        authRequired: false,
        error: getApiErrorMessage(response, "Lernset konnte nicht abonniert werden."),
      };
    }

    return {
      ok: true,
      authRequired: false,
      error: "",
    };
  } catch (error) {
    console.error("Unable to subscribe tablet to set:", error);
    return {
      ok: false,
      authRequired: false,
      error: "Server nicht erreichbar. Bitte erneut versuchen.",
    };
  }
}

async function removeTabletSubscription(tabletId, setPath) {
  try {
    const response = await apiRequest(
      `/api/tablets/${encodeURIComponent(tabletId)}/subscriptions?set=${encodeURIComponent(setPath)}`,
      {
        auth: "tablet",
        tabletId,
        method: "DELETE",
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await handleExpiredTabletSession(tabletId);
        return {
          ok: false,
          authRequired: true,
          error: getApiErrorMessage(response, "Sitzung abgelaufen. Bitte erneut mit PIN anmelden."),
        };
      }

      return {
        ok: false,
        authRequired: false,
        error: getApiErrorMessage(response, "Abo konnte nicht beendet werden."),
      };
    }

    return {
      ok: true,
      authRequired: false,
      error: "",
    };
  } catch (error) {
    console.error("Unable to remove tablet subscription:", error);
    return {
      ok: false,
      authRequired: false,
      error: "Server nicht erreichbar. Bitte erneut versuchen.",
    };
  }
}

async function handleRegistrationSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const tabletId = typeof formData.get("tabletId") === "string"
    ? formData.get("tabletId").trim()
    : "";
  const pin = typeof formData.get("registration-pin") === "string"
    ? formData.get("registration-pin").trim()
    : "";
  const pinConfirm = typeof formData.get("registration-pin-confirm") === "string"
    ? formData.get("registration-pin-confirm").trim()
    : "";

  if (!tabletId) {
    renderRegistrationState({
      selectedTabletId: DEFAULT_TABLET_ID,
      feedback: "Bitte wähle ein Tablet aus.",
    });
    return;
  }

  if (!isValidPinFormat(pin)) {
    renderRegistrationState({
      selectedTabletId: tabletId,
      feedback: "Der PIN muss aus 4 bis 8 Ziffern bestehen.",
    });
    return;
  }

  if (pin !== pinConfirm) {
    renderRegistrationState({
      selectedTabletId: tabletId,
      feedback: "Die PIN-Eingaben stimmen nicht überein.",
    });
    return;
  }

  const submitButton = form.querySelector(".student-screen__submit");

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/register`, {
      method: "POST",
      body: {
        pin,
      },
    });

    if (response.ok) {
      persistTabletSession(tabletId, response.data?.session?.token || "");
      syncActiveTabletContext(response.data?.tablet || null);
      await continueAfterDeviceAccess(tabletId);
      return;
    }

    if (response.status === 409) {
      renderAccessState({
        loginTabletId: tabletId,
        loginFeedback: "Dieser Zugang ist schon eingerichtet. Bitte mit PIN weiter.",
      });
      return;
    }

    renderAccessState({
      loginTabletId: loadLocalTabletId() || "",
      registrationTabletId: tabletId,
      registrationFeedback: getApiErrorMessage(response, "Registrierung fehlgeschlagen."),
      showRegistration: true,
    });
  } catch (error) {
    console.error("Unable to register tablet:", error);
    renderAccessState({
      loginTabletId: loadLocalTabletId() || "",
      registrationTabletId: tabletId,
      registrationFeedback: "Server nicht erreichbar. Bitte erneut versuchen.",
      showRegistration: true,
    });
  }
}

async function handlePinSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const accessVariant = form.dataset.accessVariant || "login";
  const formData = new FormData(form);
  const tabletId = typeof formData.get("tabletId") === "string"
    ? normalizeTabletIdInput(formData.get("tabletId"))
    : (form.dataset.tabletId || loadLocalTabletId() || DEFAULT_TABLET_ID);
  const pin = typeof formData.get("pin-entry") === "string"
    ? formData.get("pin-entry").trim()
    : "";

  if (!tabletId) {
    renderAccessState({
      loginFeedback: "Bitte wähle dein Tablet aus.",
      knownDeviceFeedback: state.accessKnownDeviceFeedback,
      showRegistration: state.accessRegistrationOpen,
    });
    return;
  }

  if (!pin) {
    renderAccessState({
      loginTabletId: tabletId,
      loginFeedback: accessVariant === "login" ? "Bitte gib den PIN ein." : "",
      knownDeviceFeedback: accessVariant === "quick" ? "Bitte gib den PIN ein." : "",
      showRegistration: state.accessRegistrationOpen,
    });
    return;
  }

  const submitButton = form.querySelector(".student-screen__submit");

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/verify-pin`, {
      method: "POST",
      body: {
        pin,
      },
    });

    if (response.ok) {
      persistTabletSession(tabletId, response.data?.session?.token || "");
      syncActiveTabletContext(response.data?.tablet || null);
      await continueAfterDeviceAccess(tabletId);
      return;
    }

    if (response.status === 409) {
      clearLocalTabletId();
      clearStudentSessionUnlock();
      clearTabletSession();
      clearActiveTabletContext();
      renderAccessState({
        loginTabletId: tabletId,
        registrationTabletId: tabletId,
        registrationFeedback: "Dieser Zugang ist auf diesem Tablet noch nicht eingerichtet.",
        showRegistration: true,
      });
      return;
    }

    renderAccessState({
      loginTabletId: tabletId,
      loginFeedback: accessVariant === "login"
        ? getApiErrorMessage(response, "PIN konnte nicht geprüft werden.")
        : "",
      knownDeviceFeedback: accessVariant === "quick"
        ? getApiErrorMessage(response, "PIN konnte nicht geprüft werden.")
        : "",
      showRegistration: state.accessRegistrationOpen,
    });
  } catch (error) {
    console.error("Unable to verify tablet pin:", error);
    renderAccessState({
      loginTabletId: tabletId,
      loginFeedback: accessVariant === "login" ? "Server nicht erreichbar. Bitte erneut versuchen." : "",
      knownDeviceFeedback: accessVariant === "quick" ? "Server nicht erreichbar. Bitte erneut versuchen." : "",
      showRegistration: state.accessRegistrationOpen,
    });
  }
}

function isValidPinFormat(pin) {
  return /^[0-9]{4,8}$/.test(pin);
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.auth === "tablet") {
    const session = loadTabletSession(options.tabletId || loadLocalTabletId());

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
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

function getApiErrorMessage(response, fallbackMessage) {
  return typeof response?.data?.error === "string" && response.data.error.trim()
    ? response.data.error.trim()
    : fallbackMessage;
}

function getSetStorageKey(data) {
  const explicitId = typeof data?.set?.id === "string"
    ? data.set.id.trim()
    : typeof data?.id === "string"
      ? data.id.trim()
      : "";
  return explicitId || "example-set-improved";
}

async function loadServerLearningProgress(tabletId, setPath, setStorageKey) {
  void setStorageKey;
  const response = await apiRequest(
    `/api/tablets/${encodeURIComponent(tabletId)}/learning-progress?set=${encodeURIComponent(setPath)}`,
    {
      auth: "tablet",
      tabletId,
    },
  );

  if (response.status === 409) {
    await handleDecoupledTabletState(tabletId);
    throw new Error("TABLET_DECOUPLED");
  }

  if (response.status === 401 || response.status === 403) {
    await handleExpiredTabletSession(tabletId);
    throw new Error("TABLET_AUTH_REQUIRED");
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response, "Lernstand konnte nicht geladen werden."));
  }

  syncActiveTabletContext(response.data?.tablet || null);
  return normalizeStarStates(response.data?.progress?.starStates);
}

async function saveTabletLearningProgress(tabletId, setPath, starStates) {
  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/learning-progress`, {
      auth: "tablet",
      tabletId,
      method: "PUT",
      body: {
        setPath,
        starStates,
      },
    });

    if (response.status === 409) {
      await handleDecoupledTabletState(tabletId);
      return {
        ok: false,
        decoupled: true,
        authRequired: false,
        error: "Tablet wurde entkoppelt.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      await handleExpiredTabletSession(tabletId);
      return {
        ok: false,
        decoupled: false,
        authRequired: true,
        error: "Sitzung abgelaufen. Bitte erneut mit PIN anmelden.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        decoupled: false,
        authRequired: false,
        error: getApiErrorMessage(response, "Lernstand konnte nicht gespeichert werden."),
      };
    }

    syncActiveTabletContext(response.data?.tablet || null);
    return {
      ok: true,
      decoupled: false,
      authRequired: false,
      error: "",
    };
  } catch (error) {
    console.error("Unable to save learning progress:", error);
    return {
      ok: false,
      decoupled: false,
      authRequired: false,
      error: "Server nicht erreichbar. Lernstand konnte nicht gespeichert werden.",
    };
  }
}

async function persistServerLearningProgress(previousStarStates) {
  const tabletId = loadLocalTabletId();
  const setPath = state.currentSetPath;

  if (!tabletId || !setPath) {
    state.learningProgressSavePending = false;
    updateStarButtons();
    return;
  }

  const nextStarStates = normalizeStarStates(state.starStates);
  const result = await saveTabletLearningProgress(tabletId, setPath, nextStarStates);

  if (!result.ok) {
    state.learningProgressSavePending = false;

    if (result.decoupled || result.authRequired) {
      return;
    }

    state.starStates = previousStarStates;
    updateStarButtons();
    renderCard();
    window.alert(result.error);
    return;
  }

  state.learningProgressSavePending = false;
  updateStarButtons();
}

async function handleDecoupledTabletState(tabletId) {
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";
  state.setStorageKey = "";
  state.starStates = {};
  state.learningProgressSavePending = false;
  clearLocalTabletId();
  clearStudentSessionUnlock();
  clearTabletSession();
  clearActiveTabletContext();
  resetTabletDirectoryCache();
  await ensureTabletDirectoryLoaded();
  renderAccessState({
    loginTabletId: "",
    registrationTabletId: tabletId,
    registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Lernsets und ohne Lernstände.",
    showRegistration: true,
  });
}

async function handleExpiredTabletSession(tabletId, feedback = "Sitzung abgelaufen. Bitte PIN erneut eingeben.") {
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";
  state.learningProgressSavePending = false;
  clearStudentSessionUnlock();
  clearTabletSession();
  clearActiveTabletContext();
  resetTabletDirectoryCache();
  await ensureTabletDirectoryLoaded();
  state.accessUseAlternate = false;
  renderAccessState({
    loginTabletId: tabletId,
    knownDeviceFeedback: feedback,
    showRegistration: false,
  });
}

function normalizeStarStates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const nextStates = {};

  for (const [cardId, rawState] of Object.entries(value)) {
    const normalizedCardId = typeof cardId === "string" ? cardId.trim() : "";
    const normalizedState = typeof rawState === "string" ? rawState.trim() : "";

    if (!normalizedCardId || !isStoredStarState(normalizedState)) {
      continue;
    }

    nextStates[normalizedCardId] = normalizedState;
  }

  return nextStates;
}

function isStoredStarState(value) {
  return value === "green" || value === "yellow" || value === "orange";
}

function syncActiveTabletContext(tablet) {
  if (!tablet || typeof tablet !== "object") {
    return;
  }

  state.activeTabletPairingId = typeof tablet.pairingId === "string" ? tablet.pairingId.trim() : "";
  updateKnownTabletMeta(tablet);
}

function clearActiveTabletContext() {
  state.activeTabletPairingId = "";
}

function resetTabletDirectoryCache() {
  state.availableTablets = [];
  tabletDirectoryPromise = null;
}

function updateKnownTabletMeta(tablet) {
  const nextMeta = normalizeTabletMeta(tablet);

  if (!nextMeta) {
    return;
  }

  const index = state.availableTablets.findIndex((entry) => entry.id === nextMeta.id);

  if (index === -1) {
    state.availableTablets = [...state.availableTablets, nextMeta].sort((left, right) =>
      left.label.localeCompare(right.label, "de", {
        numeric: true,
        sensitivity: "base",
      }));
    return;
  }

  state.availableTablets[index] = {
    ...state.availableTablets[index],
    ...nextMeta,
  };
}

function buildCards(data) {
  if (!data || !Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error("Vocabulary set contains no cards.");
  }

  return data.cards.map((card) => buildCardData(card));
}

function buildCardData(card) {
  const sourceText = card?.source?.text?.trim();
  const targetText = card?.target?.text?.trim();
  const audioSource = normalizeAudioPath(card?.audio?.source);
  const audioTarget = normalizeAudioPath(card?.audio?.target);
  const flashcardHintData = card?.hintData?.flashcard;
  const exampleId = flashcardHintData?.exampleId?.trim();
  const maskedWord = flashcardHintData?.maskedWord?.trim();
  const firstLetterHint = flashcardHintData?.firstLetterHint?.trim();

  if (
    typeof sourceText !== "string" ||
    typeof targetText !== "string" ||
    sourceText === "" ||
    targetText === ""
  ) {
    throw new Error("First card is missing source.text or target.text.");
  }

  if (
    typeof exampleId !== "string" ||
    typeof maskedWord !== "string" ||
    typeof firstLetterHint !== "string" ||
    exampleId === "" ||
    maskedWord === "" ||
    firstLetterHint === ""
  ) {
    throw new Error("First card is missing flashcard hint data.");
  }

  const example = card?.examples?.find((entry) => entry?.id === exampleId);
  const exampleText = example?.target?.trim();

  if (!exampleText) {
    throw new Error("First card is missing the example referenced by hintData.flashcard.");
  }

  const acceptedAnswers = Array.isArray(card.acceptedAnswers)
    ? card.acceptedAnswers
        .filter((answer) => typeof answer === "string")
        .map((answer) => answer.trim())
        .filter(Boolean)
    : [];

  return {
    id: card?.id?.trim() || sourceText,
    sourceText,
    targetText,
    backContext: buildBackContextData({
      exampleText,
      targetText,
      acceptedAnswers,
    }),
    hints: [
      buildHintData({
        exampleText,
        targetText,
        acceptedAnswers,
        replacement: maskedWord,
        preferAcceptedAnswers: false,
      }),
      buildHintData({
        exampleText,
        targetText,
        acceptedAnswers,
        replacement: firstLetterHint,
        preferAcceptedAnswers: true,
      }),
    ],
    audioSource,
    audioTarget,
  };
}

function normalizeAudioPath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveSetAssetPath(value) {
  const normalizedValue = normalizeAudioPath(value);

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.startsWith("/")) {
    return new URL(normalizedValue, window.location.origin).href;
  }

  if (normalizedValue.startsWith("./") || normalizedValue.startsWith("../")) {
    return state.currentSetBaseUrl
      ? new URL(normalizedValue, state.currentSetBaseUrl).href
      : new URL(normalizedValue, getAppBaseUrl()).href;
  }

  return new URL(normalizedValue, getAppBaseUrl()).href;
}

function buildHintData({
  exampleText,
  targetText,
  acceptedAnswers,
  replacement,
  preferAcceptedAnswers,
}) {
  const candidates = buildHintCandidates({
    targetText,
    acceptedAnswers,
    preferAcceptedAnswers,
  });

  for (const candidate of candidates) {
    const hintData = splitHintText(exampleText, candidate, replacement);

    if (hintData) {
      return hintData;
    }
  }

  throw new Error("Unable to derive hint text from the first card.");
}

function buildBackContextData({ exampleText, targetText, acceptedAnswers }) {
  const candidates = buildHintCandidates({
    targetText,
    acceptedAnswers,
    preferAcceptedAnswers: true,
  });

  for (const candidate of candidates) {
    const contextData = splitHintText(exampleText, candidate, candidate);

    if (contextData) {
      return contextData;
    }
  }

  return {
    beforeText: "",
    matchText: "",
    matchLength: 0,
    replacement: "",
    afterText: exampleText,
    accessibleText: exampleText,
  };
}

function buildHintCandidates({ targetText, acceptedAnswers, preferAcceptedAnswers }) {
  const candidates = [];
  const seen = new Set();
  const bareInfinitive = targetText.toLowerCase().startsWith("to ")
    ? targetText.slice(3).trim()
    : "";
  const orderedValues = preferAcceptedAnswers
    ? [...acceptedAnswers, bareInfinitive, targetText]
    : [targetText, ...acceptedAnswers, bareInfinitive];

  for (const value of orderedValues) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    candidates.push(normalizedValue);
  }

  return candidates;
}

function splitHintText(text, searchValue, replacement) {
  const expression = new RegExp(escapeForRegExp(searchValue), "i");
  const match = text.match(expression);

  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const end = start + match[0].length;

  return {
    beforeText: text.slice(0, start),
    matchText: match[0],
    matchLength: match[0].length,
    replacement,
    afterText: text.slice(end),
    accessibleText: text.replace(expression, replacement),
  };
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleCardClick(event) {
  if (!canFlipCard()) {
    return;
  }

  if (isEventFromCardControl(event)) {
    return;
  }

  if (shouldIgnoreCardClick()) {
    return;
  }

  if (state.suppressNextClick) {
    state.suppressNextClick = false;
    return;
  }

  flipCard(getFlipDirectionFromEvent(event));
}

function handleCardKeydown(event) {
  if (isEventFromCardControl(event)) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  handleCardClick();
}

function handleWindowKeydown(event) {
  if (elements.studentSetModal && !elements.studentSetModal.hidden && event.key === "Escape") {
    event.preventDefault();
    closeStudentSetModal();
    return;
  }

  if (elements.addSetModal && !elements.addSetModal.hidden && event.key === "Escape") {
    event.preventDefault();
    closeAddSetModal();
    return;
  }

  if (elements.launchModeModal && !elements.launchModeModal.hidden && event.key === "Escape") {
    event.preventDefault();
    closeLaunchModeModal();
    return;
  }

  if (event.key === "Escape") {
    closeStudentSetMenus();
  }

  if (event.defaultPrevented || !canFlipCard()) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    flipCard("left");
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    flipCard("right");
  }
}

function flipCard(direction = "right") {
  stopCurrentAudio();

  if (!state.isFlipped) {
    state.hasRevealedAnswer = true;
    clearHintDelay();
  }

  startFlipMotion(direction);
  state.flipRotationDeg += direction === "left" ? -180 : 180;
  state.isFlipped = !state.isFlipped;
  renderCard();
}

function evaluateCurrentCard(result) {
  if (!state.currentCard) {
    return;
  }

  if (result === "known") {
    state.knownCount += 1;
  } else if (result === "unknown") {
    state.unknownCount += 1;
  }

  if (result === "unknown") {
    state.roundUnknownCards.push(state.currentCard);
  }

  const isLastCardInRound = state.currentIndex >= state.cards.length - 1;

  if (!isLastCardInRound) {
    goToNextCard();
    return;
  }

  if (state.roundUnknownCards.length > 0) {
    renderRoundSummaryState();
    return;
  }

  if (state.roundMode === "main" && !state.hasStartedStarReview) {
    const starReviewCards = getStarReviewCards();

    if (starReviewCards.length > 0) {
      renderStarReviewIntroState(starReviewCards);
      return;
    }
  }

  renderCompletionState();
}

function handlePrimaryAction(event) {
  markControlInteraction();
  event.preventDefault();
  event.stopPropagation();

  if (state.summaryMode === "round") {
    startRound([...state.pendingNextRoundCards], state.pendingNextRoundNumber, state.roundMode);
    return;
  }

  if (state.summaryMode === "star-review") {
    state.hasStartedStarReview = true;
    startRound([...state.pendingStarReviewCards], 1, "star");
    return;
  }

  if (state.isComplete) {
    restartLearningSession();
    return;
  }

  if (!state.currentCard) {
    return;
  }

  if (isHintSequenceComplete()) {
    flipCard();
    return;
  }

  if (!state.hintReady) {
    return;
  }

  state.hintLevel = Math.min(state.hintLevel + 1, state.currentCard.hints.length);
  renderCard();
}

function handleStarAction(event) {
  markControlInteraction();
  event.preventDefault();
  event.stopPropagation();

  if (!state.currentCard || state.learningProgressSavePending) {
    return;
  }

  const currentState = getCurrentStarState();
  const currentIndex = STAR_SEQUENCE.indexOf(currentState);
  const nextState = STAR_SEQUENCE[(currentIndex + 1) % STAR_SEQUENCE.length];
  const previousStarStates = { ...state.starStates };

  if (nextState === "none") {
    delete state.starStates[state.currentCard.id];
  } else {
    state.starStates[state.currentCard.id] = nextState;
  }

  state.learningProgressSavePending = true;
  updateStarButtons();
  triggerStarCommitMotion();
  void persistServerLearningProgress(previousStarStates);
}

function handleEvalAction(event) {
  markControlInteraction();
  event.preventDefault();
  event.stopPropagation();

  if (!state.currentCard || !state.isFlipped) {
    return;
  }

  const result = event.currentTarget?.dataset?.evalButton;

  if (result !== "known" && result !== "unknown") {
    return;
  }

  settleSwipe(result);
}

function handleAudioAction(event) {
  if (event.type === "click" && performance.now() < state.suppressAudioClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  triggerAudioPlayback(event.currentTarget, event);
}

function handleAudioPointerUp(event) {
  event.stopPropagation();

  if ((event.pointerType || "mouse") === "mouse") {
    return;
  }

  state.suppressAudioClickUntil = performance.now() + 450;
  triggerAudioPlayback(event.currentTarget, event);
}

function triggerAudioPlayback(audioButton, event) {
  markControlInteraction();
  event.preventDefault();
  event.stopPropagation();

  if (!state.currentCard) {
    return;
  }

  const face = audioButton?.dataset?.audioFace === "back" ? "back" : "front";
  const audioState = getAudioStateForFace(state.currentCard, face);

  if (!audioState.path) {
    return;
  }

  playAudio(audioState.path);
}

function getCurrentStarState() {
  if (!state.currentCard) {
    return "none";
  }

  return state.starStates[state.currentCard.id] || "none";
}

function triggerStarCommitMotion() {
  clearStarCommitMotion();

  for (const starButton of elements.starButtons) {
    starButton.classList.remove("is-committing");
  }

  void elements.flashcard.offsetWidth;

  for (const starButton of elements.starButtons) {
    if (!starButton.hidden) {
      starButton.classList.add("is-committing");
    }
  }

  state.starCommitId = window.setTimeout(() => {
    clearStarCommitMotion();
  }, 180);
}

function clearStarCommitMotion() {
  if (state.starCommitId !== null) {
    window.clearTimeout(state.starCommitId);
    state.starCommitId = null;
  }

  for (const starButton of elements.starButtons) {
    starButton.classList.remove("is-committing");
  }
}

function getStarReviewCards() {
  return state.allCards.filter((card) => state.starStates[card.id] === "orange");
}

function startRound(cards, roundNumber, roundMode = "main") {
  state.cards = cards;
  state.roundMode = roundMode;
  state.roundNumber = roundNumber;
  state.roundUnknownCards = [];
  state.isComplete = false;
  state.summaryMode = null;
  state.pendingNextRoundCards = [];
  state.pendingNextRoundNumber = null;
  state.pendingStarReviewCards = [];
  state.summaryRoundKnownCount = 0;
  state.summaryRoundUnknownCount = 0;
  state.currentIndex = 0;
  state.currentCard = state.cards[0];
  resetCurrentCardState();
  renderCard();
}

function restartLearningSession() {
  state.roundMode = "main";
  state.hasStartedStarReview = false;
  state.pendingStarReviewCards = [];
  state.knownCount = 0;
  state.unknownCount = 0;
  startRound([...state.allCards], 1, "main");
}

function startHintDelay() {
  clearHintDelay();
  state.hintDelayId = window.setTimeout(() => {
    state.hintReady = true;
    state.hintDelayId = null;
    renderCard();
  }, 2000);
}

function stopControlEventPropagation(event) {
  event.stopPropagation();
}

function handleControlPointerDown(event) {
  markControlInteraction();
  stopControlEventPropagation(event);
}

function clearHintDelay() {
  if (state.hintDelayId !== null) {
    window.clearTimeout(state.hintDelayId);
    state.hintDelayId = null;
  }
}

function resetCurrentCardState() {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();

  state.isFlipped = false;
  state.flipRotationDeg = 0;
  state.isComplete = false;
  state.hasRevealedAnswer = false;
  state.hintLevel = 0;
  state.hintReady = false;
  state.hintProgressCycle += 1;
  state.suppressNextClick = false;

  startHintDelay();
}

function startFlipMotion(direction) {
  clearFlipMotion();

  elements.flashcard.classList.add("is-animating");
  elements.flashcard.classList.add(
    direction === "left" ? "is-animating-left" : "is-animating-right",
  );

  state.flipMotionId = window.setTimeout(() => {
    clearFlipMotion();
  }, 560);
}

function clearFlipMotion() {
  if (state.flipMotionId !== null) {
    window.clearTimeout(state.flipMotionId);
    state.flipMotionId = null;
  }

  elements.flashcard.classList.remove("is-animating", "is-animating-left", "is-animating-right");
}

function startFlipReset() {
  clearFlipReset();
  elements.flashcard.classList.add("is-flip-resetting");

  state.flipResetId = window.requestAnimationFrame(() => {
    state.flipResetId = window.requestAnimationFrame(() => {
      clearFlipReset();
    });
  });
}

function clearFlipReset() {
  if (state.flipResetId !== null) {
    window.cancelAnimationFrame(state.flipResetId);
    state.flipResetId = null;
  }

  elements.flashcard.classList.remove("is-flip-resetting");
}

function canFlipCard() {
  return state.appMode === APP_MODES.FLASHCARD && Boolean(state.currentCard);
}

function canNavigatePrevious() {
  return state.currentIndex > 0;
}

function canNavigateNext() {
  return state.currentIndex < state.cards.length - 1;
}

function goToPreviousCard() {
  if (!canNavigatePrevious()) {
    return;
  }

  goToCard(state.currentIndex - 1);
}

function goToNextCard() {
  if (!canNavigateNext()) {
    return;
  }

  goToCard(state.currentIndex + 1);
}

function goToCard(index) {
  stopCurrentAudio();
  state.currentIndex = index;
  state.currentCard = state.cards[index];
  resetCurrentCardState();
  renderCard();
}

function getFlipDirectionFromEvent(event) {
  if (!event || typeof event.clientX !== "number") {
    return "right";
  }

  const bounds = elements.flashcard.getBoundingClientRect();
  const midpoint = bounds.left + bounds.width / 2;

  return event.clientX < midpoint ? "left" : "right";
}

function isEventFromCardControl(event) {
  return Boolean(event?.target?.closest?.(".card-control"));
}

function markControlInteraction() {
  state.ignoreCardClickUntil = performance.now() + 320;
}

function shouldIgnoreCardClick() {
  return performance.now() < state.ignoreCardClickUntil;
}

function isHintSequenceComplete() {
  return Boolean(state.currentCard) && state.hintLevel >= state.currentCard.hints.length;
}

function handleSwipePointerDown(event) {
  if (!state.isFlipped || !state.currentCard) {
    return;
  }

  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  if (event.target.closest && event.target.closest(".card-control")) {
    return;
  }

  state.swipeActive = true;
  state.swipeMoved = false;
  state.swipePointerId = event.pointerId;
  state.swipePointerType = event.pointerType || "";
  state.swipeCardWidth = elements.flashcard.getBoundingClientRect().width;
  state.swipeMetrics = getSwipeInteractionMetrics(state.swipeCardWidth);
  state.swipeStartX = event.clientX;
  state.swipeStartY = event.clientY;
  state.swipeDeltaX = 0;
  state.swipeDeltaY = 0;
  state.swipeHasRenderedMove = false;
  elements.flashcard.classList.add("is-swipe-armed");

  if (elements.flashcard.setPointerCapture) {
    elements.flashcard.setPointerCapture(event.pointerId);
  }
}

function handleSwipePointerMove(event) {
  if (!state.swipeActive || event.pointerId !== state.swipePointerId) {
    return;
  }

  state.swipeDeltaX = event.clientX - state.swipeStartX;
  state.swipeDeltaY = event.clientY - state.swipeStartY;
  state.swipeMoved = state.swipeMoved
    || Math.hypot(state.swipeDeltaX, state.swipeDeltaY) > 8;

  if (!state.swipeHasRenderedMove) {
    state.swipeHasRenderedMove = true;
    updateSwipeVisual(state.swipeDeltaX);
  } else {
    scheduleSwipeVisualUpdate();
  }

  if (state.swipeMoved) {
    event.preventDefault();
  }
}

function handleSwipePointerUp(event) {
  if (!state.swipeActive || event.pointerId !== state.swipePointerId) {
    return;
  }

  if (elements.flashcard.releasePointerCapture) {
    elements.flashcard.releasePointerCapture(event.pointerId);
  }

  const { threshold } = state.swipeMetrics ?? getSwipeInteractionMetrics(state.swipeCardWidth);
  const shouldEvaluate = state.swipeMoved && Math.abs(state.swipeDeltaX) >= threshold;

  state.suppressNextClick = state.swipeMoved;
  state.swipeActive = false;
  state.swipePointerId = null;
  elements.flashcard.classList.remove("is-swipe-armed");

  if (shouldEvaluate) {
    settleSwipe(state.swipeDeltaX > 0 ? "known" : "unknown");
    return;
  }

  resetSwipeVisual();
}

function handleSwipePointerCancel() {
  if (!state.swipeActive) {
    return;
  }

  state.swipeActive = false;
  state.swipePointerId = null;
  elements.flashcard.classList.remove("is-swipe-armed");
  resetSwipeVisual();
}

function scheduleSwipeVisualUpdate() {
  if (state.swipeFrameId !== null) {
    return;
  }

  state.swipeFrameId = window.requestAnimationFrame(() => {
    state.swipeFrameId = null;
    updateSwipeVisual(state.swipeDeltaX);
  });
}

function clearSwipeAnimationFrame() {
  if (state.swipeFrameId !== null) {
    window.cancelAnimationFrame(state.swipeFrameId);
    state.swipeFrameId = null;
  }
}

function getSwipeInteractionMetrics(cardWidth) {
  const touchInput = state.swipePointerType === "touch";

  return {
    threshold: Math.min(touchInput ? 170 : 180, cardWidth * (touchInput ? 0.18 : 0.2)),
    maxFollow: Math.max(touchInput ? 320 : 260, cardWidth * (touchInput ? 0.82 : 0.72)),
    maxFollowY: touchInput ? 120 : 92,
    yFollowFactor: touchInput ? 0.24 : 0.2,
    tiltMax: touchInput ? 8 : 10,
    tiltDivisor: touchInput ? 34 : 28,
  };
}

function updateSwipeVisual(deltaX) {
  const cardWidth = state.swipeCardWidth || elements.flashcard.getBoundingClientRect().width;
  const {
    threshold,
    maxFollow,
    maxFollowY,
    yFollowFactor,
    tiltMax,
    tiltDivisor,
  } = state.swipeMetrics ?? getSwipeInteractionMetrics(cardWidth);
  const limitedX = clamp(deltaX, -maxFollow, maxFollow);
  const rawY = state.swipeDeltaY * yFollowFactor;
  const limitedY = clamp(rawY, -maxFollowY, maxFollowY);
  const tilt = clamp(limitedX / tiltDivisor, -tiltMax, tiltMax);
  const absX = Math.abs(limitedX);
  const tintProgress = clamp(absX / Math.max(maxFollow * 0.94, 1), 0, 1);
  const tintOpacity = tintProgress * 0.27;
  const dragProgress = clamp(absX / Math.max(maxFollow * 0.96, 1), 0, 1);
  const dragOpacity = 1 - easeOutCubic(dragProgress) * 0.78;
  const tintRgb = limitedX >= 0 ? "112 146 121" : "154 103 98";

  elements.flashcard.classList.add("is-swipe-dragging");
  elements.flashcardMotion.style.setProperty("--swipe-x", `${limitedX}px`);
  elements.flashcardMotion.style.setProperty("--swipe-y", `${limitedY}px`);
  elements.flashcardMotion.style.setProperty("--swipe-tilt", `${tilt}deg`);
  elements.flashcard.style.setProperty("--swipe-content-opacity", `${dragOpacity}`);
  elements.flashcard.style.setProperty("--swipe-tint-rgb", tintRgb);
  elements.flashcard.style.setProperty("--swipe-tint-opacity", `${tintOpacity}`);
}

function settleSwipe(result) {
  clearSwipeSettle();
  clearSwipeAnimationFrame();

  const cardWidth = state.swipeCardWidth || elements.flashcard.getBoundingClientRect().width;
  const dragY = state.swipeDeltaY;
  const touchInput = state.swipePointerType === "touch";
  const exitY = `${clamp(dragY * (touchInput ? 0.18 : 0.16), -72, 72)}px`;
  const resolvedExitX = `${(result === "known" ? 1 : -1) * Math.max(cardWidth * 1.08, 320)}px`;
  const exitTilt = result === "known" ? "10deg" : "-10deg";

  elements.flashcard.classList.remove("is-swipe-dragging");
  elements.flashcard.classList.add("is-swipe-settling");
  elements.flashcardMotion.style.setProperty("--swipe-x", resolvedExitX);
  elements.flashcardMotion.style.setProperty("--swipe-y", exitY);
  elements.flashcardMotion.style.setProperty("--swipe-tilt", exitTilt);
  elements.flashcard.style.setProperty("--swipe-content-opacity", "0.22");
  elements.flashcard.style.setProperty(
    "--swipe-tint-rgb",
    result === "known" ? "112 146 121" : "154 103 98",
  );
  elements.flashcard.style.setProperty("--swipe-tint-opacity", "0.215");
  elements.statusMessage.textContent = result === "known" ? "Known." : "Unknown.";

  state.swipeSettleId = window.setTimeout(() => {
    clearSwipeSettle();
    resetSwipeVisual();
    evaluateCurrentCard(result);
  }, 220);
}

function clearSwipeSettle() {
  if (state.swipeSettleId !== null) {
    window.clearTimeout(state.swipeSettleId);
    state.swipeSettleId = null;
  }
}

function resetSwipeVisual() {
  clearSwipeAnimationFrame();
  state.swipeDeltaX = 0;
  state.swipeDeltaY = 0;
  state.swipeHasRenderedMove = false;
  state.swipeMoved = false;
  state.swipePointerId = null;
  state.swipePointerType = "";
  state.swipeCardWidth = 0;
  state.swipeStartX = 0;
  state.swipeStartY = 0;
  state.swipeMetrics = null;
  elements.flashcard.classList.remove(
    "is-swipe-armed",
    "is-swipe-dragging",
    "is-swipe-settling",
  );
  elements.flashcardMotion.style.setProperty("--swipe-x", "0px");
  elements.flashcardMotion.style.setProperty("--swipe-y", "0px");
  elements.flashcardMotion.style.setProperty("--swipe-tilt", "0deg");
  elements.flashcard.style.setProperty("--swipe-content-opacity", "1");
  elements.flashcard.style.setProperty("--swipe-tint-opacity", "0");
  elements.flashcard.style.setProperty("--swipe-tint-rgb", "0 0 0");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function easeOutQuad(value) {
  return 1 - (1 - value) ** 2;
}

function easeInOutQuad(value) {
  return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
}

function renderLoadingState() {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();
  state.isComplete = false;
  state.summaryMode = null;
  elements.flashcard.disabled = true;
  elements.flashcard.classList.add("is-loading");
  elements.flashcard.classList.remove(
    "is-flipped",
    "has-error",
    "is-flippable",
  );
  elements.flashcard.style.setProperty("--flip-rotation", "0deg");
  elements.flashcard.setAttribute("aria-disabled", "true");
  elements.flashcard.setAttribute("tabindex", "-1");
  elements.frontContent.classList.remove("has-hint");
  updateFaceVisibility(false);
  elements.cardAction.disabled = true;
  elements.cardAction.classList.remove(
    "is-flip",
    "is-continue",
    "is-restart",
    "is-ready",
    "is-waiting",
    "progress-cycle-even",
    "progress-cycle-odd",
  );
  elements.frontWord.textContent = "\u00a0";
  elements.backWord.textContent = "\u00a0";
  elements.frontHint.textContent = "";
  elements.backHint.textContent = "";
  elements.frontHint.classList.remove("is-summary");
  elements.frontHint.classList.remove("is-visible");
  elements.statusMessage.textContent = "Lade Set.";
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({ hidden: true });
}

function renderRoundSummaryState() {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();

  state.isComplete = false;
  state.summaryMode = "round";
  state.pendingNextRoundCards = [...state.roundUnknownCards];
  state.pendingNextRoundNumber = state.roundNumber + 1;
  state.summaryRoundUnknownCount = state.roundUnknownCards.length;
  state.summaryRoundKnownCount = state.cards.length - state.summaryRoundUnknownCount;
  state.currentCard = null;
  state.currentIndex = 0;
  state.hasRevealedAnswer = false;
  state.hintLevel = 0;
  state.hintReady = false;

  elements.flashcard.disabled = true;
  elements.flashcard.classList.remove("is-loading", "has-error", "is-flipped", "is-flippable");
  elements.flashcard.style.setProperty("--flip-rotation", "0deg");
  elements.flashcard.setAttribute("aria-disabled", "true");
  elements.flashcard.setAttribute("tabindex", "-1");
  elements.frontContent.classList.remove("has-hint");
  updateFaceVisibility(false);
  elements.cardAction.disabled = false;
  elements.cardAction.classList.remove(
    "is-flip",
    "is-restart",
    "is-ready",
    "is-waiting",
    "progress-cycle-even",
    "progress-cycle-odd",
  );
  elements.cardAction.classList.add("is-continue");
  elements.frontWord.textContent = "Runde fertig";
  elements.backWord.textContent = "Runde fertig";
  elements.backHint.textContent = "";
  renderRoundSummary();
  elements.frontHint.classList.add("is-summary", "is-visible");
  elements.statusMessage.textContent = getRoundSummaryStatusMessage();
  elements.flashcard.setAttribute("aria-label", getRoundSummaryCardLabel());
  elements.cardAction.setAttribute("aria-label", "Weiter.");
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({
    hidden: false,
    label: getRoundSummaryProgressLabel(),
    value: 100,
  });
}

function renderStarReviewIntroState(cards) {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();

  state.isComplete = false;
  state.summaryMode = "star-review";
  state.pendingStarReviewCards = [...cards];
  state.currentCard = null;
  state.currentIndex = 0;
  state.hasRevealedAnswer = false;
  state.hintLevel = 0;
  state.hintReady = false;

  elements.flashcard.disabled = true;
  elements.flashcard.classList.remove("is-loading", "has-error", "is-flipped", "is-flippable");
  elements.flashcard.style.setProperty("--flip-rotation", "0deg");
  elements.flashcard.setAttribute("aria-disabled", "true");
  elements.flashcard.setAttribute("tabindex", "-1");
  elements.frontContent.classList.remove("has-hint");
  updateFaceVisibility(false);
  elements.cardAction.disabled = false;
  elements.cardAction.classList.remove(
    "is-flip",
    "is-continue",
    "is-restart",
    "is-ready",
    "is-waiting",
    "progress-cycle-even",
    "progress-cycle-odd",
  );
  elements.cardAction.classList.add("is-continue");
  renderStarModeWord(elements.frontWord);
  renderStarModeWord(elements.backWord);
  elements.backHint.textContent = "";
  renderStarReviewIntroSummary(cards.length);
  elements.frontHint.classList.add("is-summary", "is-visible");
  elements.statusMessage.textContent = getStarReviewIntroStatusMessage(cards.length);
  elements.flashcard.setAttribute("aria-label", getStarReviewIntroCardLabel(cards.length));
  elements.cardAction.setAttribute("aria-label", "Starten.");
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({
    hidden: false,
    label: "★-Runde · bereit",
    value: 100,
  });
}

function renderStarModeWord(target) {
  target.replaceChildren();

  const wrapper = document.createElement("span");
  wrapper.className = "flashcard__word--mode";

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined flashcard__word-icon";
  icon.textContent = "star";

  wrapper.append(icon, document.createTextNode("-Runde"));
  target.append(wrapper);
}

function renderCompletionState() {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();

  state.isComplete = true;
  state.summaryMode = null;
  state.currentCard = null;
  state.currentIndex = 0;
  state.hasRevealedAnswer = false;
  state.hintLevel = 0;
  state.hintReady = false;

  elements.flashcard.disabled = true;
  elements.flashcard.classList.remove("is-loading", "has-error", "is-flipped", "is-flippable");
  elements.flashcard.style.setProperty("--flip-rotation", "0deg");
  elements.flashcard.setAttribute("aria-disabled", "true");
  elements.flashcard.setAttribute("tabindex", "-1");
  elements.frontContent.classList.remove("has-hint");
  updateFaceVisibility(false);
  elements.cardAction.disabled = false;
  elements.cardAction.classList.remove(
    "is-flip",
    "is-continue",
    "is-ready",
    "is-waiting",
    "progress-cycle-even",
    "progress-cycle-odd",
  );
  elements.cardAction.classList.add("is-restart");
  elements.frontWord.textContent = "Fertig";
  elements.backWord.textContent = "Fertig";
  elements.backHint.textContent = "";
  renderCompletionSummary();
  elements.frontHint.classList.add("is-summary");
  elements.frontHint.classList.add("is-visible");
  elements.statusMessage.textContent = getCompletionStatusMessage();
  elements.flashcard.setAttribute("aria-label", getCompletionCardLabel());
  elements.cardAction.setAttribute("aria-label", "Neu starten.");
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({
    hidden: false,
    label: "Durchgang · fertig",
    value: 100,
  });
}

function renderCard() {
  const {
    sourceText,
    targetText,
    hints,
    backContext,
  } = state.currentCard;
  const currentHint = !state.hasRevealedAnswer && state.hintLevel > 0
    ? hints[state.hintLevel - 1]
    : "";
  const cardCanFlip = canFlipCard();
  const hintSequenceComplete = isHintSequenceComplete();
  const hintAvailable = !state.hasRevealedAnswer;
  const waitingForHint = hintAvailable && !state.hintReady && !hintSequenceComplete;
  const actionIsEnabled = hintAvailable && (state.hintReady || hintSequenceComplete);
  const hintReadyState = hintAvailable && state.hintReady && !hintSequenceComplete;
  const hintProgressClass = state.hintProgressCycle % 2 === 0
    ? "progress-cycle-even"
    : "progress-cycle-odd";

  elements.flashcard.disabled = false;
  elements.flashcard.classList.remove("is-loading", "has-error");
  elements.flashcard.classList.toggle("is-flipped", state.isFlipped);
  elements.flashcard.classList.toggle("is-flippable", cardCanFlip);
  elements.flashcard.style.setProperty("--flip-rotation", `${state.flipRotationDeg}deg`);
  elements.flashcard.setAttribute("aria-disabled", "false");
  elements.flashcard.setAttribute("tabindex", "0");
  updateFaceVisibility(state.isFlipped);
  elements.frontContent.classList.toggle("has-hint", Boolean(currentHint) && !state.isFlipped);

  elements.frontWord.textContent = sourceText;
  elements.backWord.textContent = targetText;
  renderHint(currentHint);
  renderBackContext(backContext);
  elements.frontHint.classList.remove("is-summary");
  elements.frontHint.classList.toggle("is-visible", Boolean(currentHint) && !state.isFlipped);

  elements.cardAction.disabled = !actionIsEnabled;
  elements.cardAction.classList.toggle("is-flip", hintAvailable && hintSequenceComplete);
  elements.cardAction.classList.remove("is-continue");
  elements.cardAction.classList.remove("is-restart");
  elements.cardAction.classList.toggle("is-waiting", waitingForHint);
  elements.cardAction.classList.toggle("is-ready", hintReadyState);
  elements.cardAction.classList.toggle("progress-cycle-even", hintProgressClass === "progress-cycle-even");
  elements.cardAction.classList.toggle("progress-cycle-odd", hintProgressClass === "progress-cycle-odd");
  elements.cardAction.setAttribute("aria-label", getActionLabel());
  elements.statusMessage.textContent = getStatusMessage();
  elements.flashcard.setAttribute(
    "aria-label",
    getCardLabel(),
  );
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({
    hidden: false,
    label: getRoundProgressLabel(),
    value: getRoundProgressPercent(),
  });
}

function renderErrorState(message) {
  stopCurrentAudio();
  clearHintDelay();
  clearFlipMotion();
  startFlipReset();
  clearSwipeSettle();
  resetSwipeVisual();
  state.currentCard = null;
  state.isComplete = false;
  state.summaryMode = null;
  state.isFlipped = false;
  state.flipRotationDeg = 0;
  state.hasRevealedAnswer = false;
  state.hintLevel = 0;
  state.hintReady = false;

  elements.flashcard.disabled = true;
  elements.flashcard.classList.remove(
    "is-loading",
    "is-flipped",
    "is-flippable",
  );
  elements.flashcard.style.setProperty("--flip-rotation", "0deg");
  elements.flashcard.setAttribute("aria-disabled", "true");
  elements.flashcard.setAttribute("tabindex", "-1");
  elements.flashcard.classList.add("has-error");
  elements.frontContent.classList.remove("has-hint");
  updateFaceVisibility(false);
  elements.cardAction.disabled = true;
  elements.cardAction.classList.remove(
    "is-flip",
    "is-continue",
    "is-restart",
    "is-ready",
    "is-waiting",
    "progress-cycle-even",
    "progress-cycle-odd",
  );
  elements.frontWord.textContent = "Fehler";
  elements.backWord.textContent = "Fehler";
  elements.frontHint.textContent = message;
  elements.backHint.textContent = "";
  elements.frontHint.classList.remove("is-summary");
  elements.frontHint.classList.add("is-visible");
  elements.statusMessage.textContent = message;
  elements.flashcard.setAttribute("aria-label", message);
  elements.cardAction.setAttribute("aria-label", message);
  updateStarButtons();
  updateAudioButtons();
  updateEvalButtons();
  updateOutcomeCounters();
  updateProgressState({ hidden: true });
}

function updateStarButtons() {
  const starState = getCurrentStarState();
  const hasCurrentCard = Boolean(state.currentCard) && !state.summaryMode && !state.isComplete;

  for (const starButton of elements.starButtons) {
    starButton.hidden = !hasCurrentCard;
    starButton.disabled = !hasCurrentCard || state.learningProgressSavePending;
    starButton.dataset.starState = starState;
    starButton.classList.toggle("is-marked", starState !== "none");
    starButton.setAttribute("aria-label", getStarActionLabel(starState));
  }
}

function updateAudioButtons() {
  const showAudioButtons = Boolean(state.currentCard) && !state.summaryMode && !state.isComplete;

  for (const audioButton of elements.audioButtons) {
    const face = audioButton.dataset.audioFace === "back" ? "back" : "front";
    const isVisibleFace = showAudioButtons && (face === "back" ? state.isFlipped : !state.isFlipped);
    const audioState = isVisibleFace ? getAudioStateForFace(state.currentCard, face) : null;
    const isAvailable = Boolean(audioState?.path);

    audioButton.hidden = !isVisibleFace;
    audioButton.disabled = !isAvailable;
    audioButton.setAttribute("aria-label", getAudioButtonLabel(face, isAvailable, audioState));
  }
}

function getAudioStateForFace(card, face) {
  if (!card) {
    return null;
  }

  // Intentional app rule: each visible side plays its own side's static recording.
  const isBackFace = face === "back";

  return {
    face,
    text: isBackFace ? card.targetText : card.sourceText,
    path: isBackFace ? resolveSetAssetPath(card.audioTarget) : resolveSetAssetPath(card.audioSource),
  };
}

function getAudioButtonLabel(face, isAvailable, audioState = null) {
  if (!state.currentCard) {
    return "Audio nicht verfügbar.";
  }

  const sideLabel = audioState?.text || (face === "back" ? state.currentCard.targetText : state.currentCard.sourceText);

  if (!isAvailable) {
    return `${sideLabel}. Audio nicht verfügbar.`;
  }

  return `${sideLabel} abspielen.`;
}

function getAudioPlayer() {
  if (state.audioPlayer) {
    return state.audioPlayer;
  }

  const audioPlayer = new Audio();
  audioPlayer.preload = "none";
  audioPlayer.addEventListener("error", () => {
    stopCurrentAudio();
  });
  state.audioPlayer = audioPlayer;
  return audioPlayer;
}

function playAudio(audioPath) {
  const audioPlayer = getAudioPlayer();

  stopCurrentAudio();

  if (audioPlayer.src !== audioPath) {
    audioPlayer.src = audioPath;
  }

  audioPlayer.currentTime = 0;

  const playPromise = audioPlayer.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((error) => {
      console.error("Unable to play audio:", error);
      stopCurrentAudio();
    });
  }
}

function stopCurrentAudio() {
  if (!state.audioPlayer) {
    return;
  }

  state.audioPlayer.pause();

  try {
    state.audioPlayer.currentTime = 0;
  } catch (error) {
    console.error("Unable to reset audio playback:", error);
  }
}

function updateEvalButtons() {
  const showEvalButtons = Boolean(state.currentCard) && state.isFlipped && !state.summaryMode && !state.isComplete;

  for (const evalButton of elements.evalButtons) {
    evalButton.hidden = !showEvalButtons;
    evalButton.disabled = !showEvalButtons;
  }
}

function getStarActionLabel(starState) {
  if (!state.currentCard) {
    return "Schwierigkeit nicht verfügbar.";
  }

  if (starState === "none") {
    return "Schwierigkeit markieren. Nächster Zustand: grün.";
  }

  if (starState === "green") {
    return "Grün markiert. Nächster Zustand: gelb.";
  }

  if (starState === "yellow") {
    return "Gelb markiert. Nächster Zustand: orange.";
  }

  return "Orange markiert. Nächster Zustand: keine Markierung.";
}

function updateOutcomeCounters() {
  for (const counter of elements.knownCounts) {
    counter.textContent = String(state.knownCount);
  }

  for (const counter of elements.unknownCounts) {
    counter.textContent = String(state.unknownCount);
  }
}

function renderCompletionSummary() {
  elements.frontHint.replaceChildren();

  const titleLine = document.createElement("span");
  titleLine.className = "flashcard__summary-line flashcard__summary-line--title";
  titleLine.textContent = "Fertig.";

  const metricsLine = document.createElement("span");
  metricsLine.className = "flashcard__summary-line flashcard__summary-line--metrics";
  metricsLine.append(
    createSummaryStat("known", `${state.knownCount} richtig`),
    createSummaryStat("unknown", `${state.unknownCount} falsch`),
  );

  const roundLine = document.createElement("span");
  roundLine.className = "flashcard__summary-line";
  roundLine.textContent = `${state.roundNumber} Runde${state.roundNumber === 1 ? "" : "n"}.`;

  elements.frontHint.append(titleLine, metricsLine, roundLine);
  elements.frontHint.setAttribute(
    "aria-label",
    `Fertig. ${state.knownCount} richtig, ${state.unknownCount} falsch. ${state.roundNumber} Runde${state.roundNumber === 1 ? "" : "n"}.`,
  );
}

function renderRoundSummary() {
  elements.frontHint.replaceChildren();

  const titleLine = state.roundMode === "star"
    ? createStarRoundTitle("fertig.")
    : createSummaryTextLine("flashcard__summary-line flashcard__summary-line--title", "Runde fertig.");

  const metricsLine = document.createElement("span");
  metricsLine.className = "flashcard__summary-line flashcard__summary-line--metrics";
  metricsLine.append(
    createSummaryStat("known", `${state.summaryRoundKnownCount} richtig`),
    createSummaryStat("unknown", `${state.summaryRoundUnknownCount} offen`),
  );

  elements.frontHint.append(titleLine, metricsLine);
  elements.frontHint.setAttribute(
    "aria-label",
    `Runde fertig. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`,
  );
}

function renderStarReviewIntroSummary(cardCount) {
  elements.frontHint.replaceChildren();

  const metricsLine = document.createElement("span");
  metricsLine.className = "flashcard__summary-line flashcard__summary-line--metrics";
  metricsLine.append(createStarCardCountLine(cardCount));

  elements.frontHint.append(metricsLine);
  elements.frontHint.setAttribute(
    "aria-label",
    `${cardCount} Stern-Karten.`,
  );
}

function createStarRoundTitle(suffixText) {
  const titleLine = document.createElement("span");
  titleLine.className = "flashcard__summary-line flashcard__summary-line--mode";
  titleLine.append(createStarRoundWord("Runde"), document.createTextNode(` ${suffixText}`));
  return titleLine;
}

function createSummaryTextLine(className, text) {
  const line = document.createElement("span");
  line.className = className;
  line.textContent = text;
  return line;
}

function createSummaryStat(type, text) {
  const stat = document.createElement("span");
  stat.className = `flashcard__summary-stat flashcard__summary-stat--${type}`;
  stat.append(createSummaryIcon(type), document.createTextNode(text));
  return stat;
}

function createStarCardCountLine(cardCount) {
  const stat = document.createElement("span");
  stat.className = "flashcard__summary-stat flashcard__summary-stat--star";
  stat.append(
    document.createTextNode(`${cardCount} x `),
    createStarRoundWord("Karten"),
  );
  return stat;
}

function createStarRoundWord(word) {
  const wrapper = document.createElement("span");
  wrapper.className = "flashcard__star-word";
  wrapper.append(createSummaryIcon("star-inline"), document.createTextNode(`-${word}`));
  return wrapper;
}

function createSummaryIcon(type) {
  if (type === "star" || type === "star-inline") {
    const icon = document.createElement("span");
    icon.className = `flashcard__summary-icon flashcard__summary-icon--star${type === "star-inline" ? " flashcard__summary-icon--star-inline" : ""}`;
    return icon;
  }

  const icon = document.createElement("span");
  icon.className = `flashcard__summary-icon flashcard__summary-icon--${type}`;
  return icon;
}

function getRoundProgressLabel() {
  return state.roundMode === "star"
    ? `★-Runde ${state.roundNumber} · ${state.currentIndex + 1} / ${state.cards.length}`
    : `Runde ${state.roundNumber} · ${state.currentIndex + 1} / ${state.cards.length}`;
}

function getRoundSummaryProgressLabel() {
  return state.roundMode === "star"
    ? `★-Runde ${state.roundNumber} · abgeschlossen`
    : `Runde ${state.roundNumber} · abgeschlossen`;
}

function updateProgressState({ hidden, label = "", value = 0 }) {
  elements.progressShell.setAttribute("aria-hidden", String(hidden));
  elements.progressLabel.textContent = hidden ? "" : label;
  elements.progressFill.style.setProperty("--progress-value", `${clamp(value, 0, 100)}%`);
}

function getRoundProgressPercent() {
  if (!state.cards.length) {
    return 0;
  }

  return ((state.currentIndex + 1) / state.cards.length) * 100;
}

function updateFaceVisibility(isFlipped) {
  elements.frontFace.setAttribute("aria-hidden", String(isFlipped));
  elements.backFace.setAttribute("aria-hidden", String(!isFlipped));
}

function renderHint(hintData) {
  elements.frontHint.replaceChildren();

  if (!hintData) {
    elements.frontHint.removeAttribute("aria-label");
    return;
  }

  if (hintData.beforeText) {
    elements.frontHint.append(document.createTextNode(hintData.beforeText));
  }

  elements.frontHint.append(createHintMask(hintData.replacement, hintData.matchLength));

  if (hintData.afterText) {
    elements.frontHint.append(document.createTextNode(hintData.afterText));
  }

  elements.frontHint.setAttribute("aria-label", hintData.accessibleText);
}

function renderBackContext(contextData) {
  elements.backHint.replaceChildren();

  if (!contextData) {
    elements.backHint.removeAttribute("aria-label");
    return;
  }

  if (contextData.beforeText) {
    elements.backHint.append(document.createTextNode(contextData.beforeText));
  }

  if (contextData.matchText) {
    const accent = document.createElement("span");
    accent.className = "flashcard__context-accent";
    accent.textContent = contextData.matchText;
    elements.backHint.append(accent);
  }

  if (contextData.afterText) {
    elements.backHint.append(document.createTextNode(contextData.afterText));
  }

  elements.backHint.setAttribute("aria-label", contextData.accessibleText);
}

function createHintMask(replacement, matchLength) {
  const mask = document.createElement("span");
  mask.className = "flashcard__hint-mask";
  const characters = Array.from(replacement);

  for (let index = 0; index < matchLength; index += 1) {
    const character = characters[index] ?? "_";
    const slot = document.createElement("span");
    const isBlank = character === "_";

    slot.className = isBlank
      ? "flashcard__hint-slot flashcard__hint-slot--blank"
      : "flashcard__hint-slot flashcard__hint-slot--filled";
    slot.textContent = isBlank ? "\u00a0" : character;
    mask.append(slot);
  }

  return mask;
}

function getActionLabel() {
  if (!state.currentCard) {
    return "Nicht verfügbar.";
  }

  if (state.hasRevealedAnswer) {
    return "Kein Hinweis.";
  }

  if (isHintSequenceComplete()) {
    return state.isFlipped ? "Zurückdrehen." : "Aufdecken.";
  }

  if (!state.hintReady) {
    return "Hinweis folgt.";
  }

  return state.hintLevel === 0 ? "Ersten Hinweis zeigen." : "Zweiten Hinweis zeigen.";
}

function getStatusMessage() {
  if (state.summaryMode === "round") {
    return getRoundSummaryStatusMessage();
  }

  if (state.summaryMode === "star-review") {
    return getStarReviewIntroStatusMessage(state.pendingStarReviewCards.length);
  }

  if (state.isComplete) {
    return getCompletionStatusMessage();
  }

  if (!state.currentCard) {
    return "Lade Set.";
  }

  if (state.isFlipped) {
    return "Rückseite.";
  }

  if (state.hasRevealedAnswer) {
    return getCurrentRoundCardStatus();
  }

  if (state.hintLevel === 1) {
    return "Erster Hinweis.";
  }

  if (isHintSequenceComplete()) {
    return "Zweiter Hinweis.";
  }

  return state.hintReady
    ? `${getCurrentRoundCardStatus()} Hinweis bereit.`
    : `${getCurrentRoundCardStatus()} Hinweis gesperrt.`;
}

function getRoundSummaryStatusMessage() {
  return state.roundMode === "star"
    ? `Stern-Runde beendet. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`
    : `Runde beendet. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`;
}

function getStarReviewIntroStatusMessage(cardCount) {
  return `Stern-Runde. ${cardCount} Karten.`;
}

function getCompletionStatusMessage() {
  return `Fertig. ${state.knownCount} richtig. ${state.unknownCount} falsch.`;
}

function getRoundSummaryCardLabel() {
  return state.roundMode === "star"
    ? `Stern-Runde fertig. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`
    : `Runde fertig. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`;
}

function getStarReviewIntroCardLabel(cardCount) {
  return `Stern-Runde. ${cardCount} Karten.`;
}

function getCompletionCardLabel() {
  return `Fertig. ${state.knownCount} richtig. ${state.unknownCount} falsch.`;
}

function getCurrentRoundCardStatus() {
  return state.roundMode === "star"
    ? `Stern-Runde ${state.roundNumber}. Karte ${state.currentIndex + 1} von ${state.cards.length}.`
    : `Runde ${state.roundNumber}. Karte ${state.currentIndex + 1} von ${state.cards.length}.`;
}

function getCardLabel() {
  if (!state.currentCard) {
    return "Karte nicht verfügbar.";
  }

  if (state.isFlipped) {
    return `${state.currentCard.targetText}.`;
  }

  return `${state.currentCard.sourceText}. Tippen zum Aufdecken.`;
}
