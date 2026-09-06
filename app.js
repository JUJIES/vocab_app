const DEFAULT_INPUT_CORRECT_ADVANCE_DELAY_MS = 2000;
const DEFAULT_INPUT_INCORRECT_ADVANCE_DELAY_MS = 4000;
const INPUT_CORRECT_ADVANCE_MAX_MS = 3000;
const INPUT_INCORRECT_ADVANCE_MAX_MS = 4000;
const INPUT_ADVANCE_DELAY_STEP_MS = 500;
const INPUT_DELAY_PRESETS = Object.freeze({
  correct: Object.freeze([
    Object.freeze({ key: "short", label: "kurz", delayMs: 1000 }),
    Object.freeze({ key: "medium", label: "mittel", delayMs: 2000 }),
    Object.freeze({ key: "long", label: "lang", delayMs: 3000 }),
  ]),
  wrong: Object.freeze([
    Object.freeze({ key: "short", label: "kurz", delayMs: 2000 }),
    Object.freeze({ key: "medium", label: "mittel", delayMs: 3000 }),
    Object.freeze({ key: "long", label: "lang", delayMs: 4000 }),
  ]),
});
const TEST_MIN_CARD_COUNT = 5;
const TEST_DEFAULT_CARD_COUNT = 10;

const state = {
  appMode: "home",
  accessCooldownTimerId: null,
  accessRegistrationOpen: false,
  accessShareExpanded: false,
  accessUseAlternate: false,
  accessSelectedFlow: "",
  accessKnownDeviceFeedback: "",
  accessIntroVariantIndex: 0,
  accessSession: null,
  availableTablets: [],
  requestedSetPath: "",
  requestedSetUrl: "",
  currentSetPath: "",
  currentSetUrl: "",
  currentSetBaseUrl: "",
  currentSetLanguageLabels: null,
  subscriptions: [],
  baseCards: [],
  allCards: [],
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
  summaryRoundKnownCount: 0,
  summaryRoundUnknownCount: 0,
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
  suppressNextClick: false,
  ignoreCardClickUntil: 0,
  suppressAudioClickUntil: 0,
  audioPlayer: null,
  screenPrimaryAction: "",
  screenSecondaryAction: "",
  pendingLaunchSetPath: "",
  pendingLaunchSetTitle: "",
  pendingLaunchModeKey: "practice",
  pendingLaunchDirection: "source-target",
  pendingTestCardCount: TEST_DEFAULT_CARD_COUNT,
  activeTestCardCount: TEST_DEFAULT_CARD_COUNT,
  launchModeScrollY: 0,
  launchModeDetailRenderedModeKey: "",
  launchModeDetailTransitionTimerId: null,
  launchModeActionRenderedModeKey: "",
  launchModeActionTransitionTimerId: null,
  activeLearningModeKey: "practice",
  activeLearningDirection: "source-target",
  flashcardSettingsOpen: false,
  addSetModalView: "choice",
  studentSetModalMode: "",
  activeStudentSetPath: "",
  activeStudentSetTitle: "",
  activeStudentSetShareCode: "",
  activeStudentSetShareUrl: "",
  publicOrigin: "",
  activeTabletPairingId: "",
  inputAdvanceTimeoutId: null,
  inputSettingsOpen: false,
  inputCorrectionModeEnabled: true,
  inputDelayEditorType: "correct",
  inputCorrectAdvanceDelayMs: DEFAULT_INPUT_CORRECT_ADVANCE_DELAY_MS,
  inputIncorrectAdvanceDelayMs: DEFAULT_INPUT_INCORRECT_ADVANCE_DELAY_MS,
  inputSolutionRevealed: false,
  inputSession: {
    cards: [],
    currentIndex: 0,
    totalPoints: 0,
    awardedPointsForCurrentCard: 0,
    attemptCountForCurrentCard: 0,
    evaluation: null,
    scoredEvaluation: null,
    isComplete: false,
  },
  testSession: {
    cards: [],
    evaluations: {},
    initialCorrectCount: null,
    initialWrongCount: null,
    checkCount: 0,
    isComplete: false,
  },
};

const APP_MODES = Object.freeze({
  ACCESS: "access",
  HOME: "home",
  SCANNER: "scanner",
  REGISTRATION: "registration",
  PIN: "pin",
  FLASHCARD: "flashcard",
  INPUT: "input",
  TEST: "test",
  LOAD_ERROR: "load-error",
});

const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";
const ACTIVE_LEARNING_SESSION_STORAGE_KEY = "dino-vocab-active-learning-session-v1";
const LEARNING_DIRECTION_STORAGE_KEY = "dino-vocab-learning-directions-v1";
const TABLET_SET_COLOR_STORAGE_KEY = "dino-vocab-tablet-set-colors-v1";
const LOCAL_SET_METADATA_ASSET_VERSION = "2026-08-30-student-direction-v1";
const ACCESS_PIN_COOLDOWN_STEPS_MS = [
  30 * 1000,
  60 * 1000,
  5 * 60 * 1000,
];
const EXAMPLE_SET_QUERY_PATH = "sets/food-basics-01.json";
const DEFAULT_TABLET_ID = "rot-1";
const DEFAULT_TABLET_LABEL = "Rot 1";
const TABLET_DIRECTORY_API_PATH = "/api/tablet-directory";
const ACCESS_SESSION_API_PATH = "/api/access-session";
const TABLET_ICON_PATH = "./assets/icons/tablet-device.svg";
const ACCESS_CONTINUE_ICON_PATH = "./assets/icons/continue-session.svg";
const ACCESS_REGISTER_ICON_PATH = "./assets/icons/key-access.svg";
const ACCESS_BACK_ICON_PATH = "./assets/icons/access-back.svg";
const ACCESS_CLOSE_ICON_PATH = "./assets/icons/x-mark.svg";
const ACCESS_COPY_ICON_PATH = "./assets/icons/copy.svg";
const ACCESS_COPY_CHECK_ICON_PATH = "./assets/icons/check.svg";
const ACCESS_OTHER_DEVICE_ICON_PATH = "./assets/icons/device-transfer.svg";
const EXTERNAL_LINK_ICON_PATH = "./assets/icons/external-link.svg";
const BROKEN_LINK_ICON_PATH = "./assets/icons/broken-link.svg";
const LIBRARY_MINUS_ICON_PATH = "./assets/icons/library-minus.svg";
const LEARNING_MODE_ICON_PATHS = Object.freeze({
  practice: "./assets/icons/learning-mode-practice.svg",
  write: "./assets/icons/learning-mode-write.svg",
  test: "./assets/icons/learning-mode-test.svg",
});
const LEARNING_MODE_KEYS = Object.freeze([
  "practice",
  "write",
  "test",
]);
const DEFAULT_LEARNING_MODE_KEY = "practice";
const LEARNING_DIRECTIONS = Object.freeze({
  SOURCE_TARGET: "source-target",
  TARGET_SOURCE: "target-source",
});
const LEARNING_MODES = Object.freeze([
  {
    key: "practice",
    label: "Üben",
    description: "Karteikarten mit Umdrehen und richtig oder falsch.",
    iconPath: LEARNING_MODE_ICON_PATHS.practice,
    accentColor: "#7c95c9",
    accentRgb: "124, 149, 201",
    distributionPercent: 40,
    isAvailable: true,
    availabilityLabel: "Verfügbar",
  },
  {
    key: "write",
    label: "Eingabe",
    description: "Prompt sehen, Antwort eintippen und direkt prüfen.",
    iconPath: LEARNING_MODE_ICON_PATHS.write,
    accentColor: "#a184c2",
    accentRgb: "161, 132, 194",
    distributionPercent: 25,
    isAvailable: true,
    availabilityLabel: "Verfügbar",
  },
  {
    key: "test",
    label: "Testen",
    description: "Prüfmodus mit klarer Auswertung und ohne Hilfen.",
    iconPath: LEARNING_MODE_ICON_PATHS.test,
    accentColor: "#d2a96c",
    accentRgb: "210, 169, 108",
    distributionPercent: 35,
    isAvailable: true,
    availabilityLabel: "Verfügbar",
  },
]);
const STUDENT_SET_COLOR_PALETTE = Object.freeze([
  {
    key: "slate",
    label: "Slate",
    headerStart: "#70809a",
    headerEnd: "#4f5f77",
    glow: "rgba(141, 157, 182, 0.24)",
    badge: "rgba(240, 245, 255, 0.2)",
  },
  {
    key: "blue",
    label: "Blau",
    headerStart: "#6b84a6",
    headerEnd: "#4c6281",
    glow: "rgba(121, 151, 194, 0.24)",
    badge: "rgba(238, 245, 255, 0.2)",
  },
  {
    key: "indigo",
    label: "Indigo",
    headerStart: "#7579a8",
    headerEnd: "#555b84",
    glow: "rgba(137, 143, 201, 0.24)",
    badge: "rgba(243, 241, 255, 0.2)",
  },
  {
    key: "teal",
    label: "Teal",
    headerStart: "#5d8788",
    headerEnd: "#406366",
    glow: "rgba(97, 150, 151, 0.24)",
    badge: "rgba(235, 249, 247, 0.2)",
  },
  {
    key: "sage",
    label: "Sage",
    headerStart: "#7a8a73",
    headerEnd: "#586753",
    glow: "rgba(138, 156, 131, 0.22)",
    badge: "rgba(241, 248, 238, 0.2)",
  },
  {
    key: "amber",
    label: "Amber",
    headerStart: "#9a7f5c",
    headerEnd: "#725d42",
    glow: "rgba(179, 139, 92, 0.22)",
    badge: "rgba(255, 247, 231, 0.2)",
  },
  {
    key: "rose",
    label: "Rose",
    headerStart: "#927181",
    headerEnd: "#6d5361",
    glow: "rgba(174, 123, 145, 0.22)",
    badge: "rgba(255, 239, 245, 0.2)",
  },
  {
    key: "violet",
    label: "Violett",
    headerStart: "#7d7296",
    headerEnd: "#5d5573",
    glow: "rgba(146, 130, 192, 0.22)",
    badge: "rgba(244, 239, 255, 0.2)",
  },
]);
const ACCESS_INTRO_VARIANTS = Object.freeze([
  {
    emoji: "👋",
    label: "Wink",
    text: "Schön, dass du wieder da bist. Weiter mit den Vokabeln.",
  },
  {
    emoji: "🙂",
    label: "Lächeln",
    text: "Bereit für die nächste Runde Wörter? Kurz anmelden und los.",
  },
  {
    emoji: "✨",
    label: "Glanz",
    text: "PIN rein, dann geht's mit den Vokabeln weiter.",
  },
  {
    emoji: "🎉",
    label: "Party",
    text: "Schön, dass du wieder da bist. Weiter mit den Vokabeln.",
  },
  {
    emoji: "😎",
    label: "Cool",
    text: "Bereit für die nächste Runde Wörter? Kurz anmelden und los.",
  },
  {
    emoji: "🚀",
    label: "Los",
    text: "PIN rein, dann geht's mit den Vokabeln weiter.",
  },
  {
    emoji: "🙌",
    label: "Jubel",
    text: "Schön, dass du wieder da bist. Weiter mit den Vokabeln.",
  },
  {
    emoji: "📚",
    label: "Lernen",
    text: "Bereit für die nächste Runde Wörter? Kurz anmelden und los.",
  },
]);

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
  studentShareUtility: null,
  launchModeModal: document.getElementById("launch-mode-modal"),
  launchModePanel: document.querySelector(".launch-mode-modal__panel"),
  launchModeTitle: document.getElementById("launch-mode-title"),
  launchModeDescription: document.getElementById("launch-mode-description"),
  launchModeDistributionBar: document.getElementById("launch-mode-distribution-bar"),
  launchModeDistributionIndicator: document.getElementById("launch-mode-distribution-indicator"),
  launchModeDistributionLegend: document.getElementById("launch-mode-distribution-legend"),
  launchModeModes: document.getElementById("launch-mode-modes"),
  launchModeDetail: document.querySelector(".launch-mode-modal__detail"),
  launchModeDetailStage: document.getElementById("launch-mode-detail-stage"),
  launchModeDirection: document.getElementById("launch-mode-direction"),
  launchModeStart: document.getElementById("launch-mode-start"),
  launchModeStartStage: document.getElementById("launch-mode-start-stage"),
  launchModeClose: document.getElementById("launch-mode-close"),
  launchSettingsModal: document.getElementById("launch-settings-modal"),
  launchSettingsPanel: document.getElementById("launch-settings-panel"),
  launchSettingsTitle: document.getElementById("launch-settings-title"),
  launchSettingsDescription: document.getElementById("launch-settings-description"),
  launchSettingsAdditional: document.getElementById("launch-settings-additional"),
  launchSettingsStart: document.getElementById("launch-settings-start"),
  launchSettingsStartLabel: document.getElementById("launch-settings-start-label"),
  launchSettingsBack: document.getElementById("launch-settings-back"),
  launchSettingsClose: document.getElementById("launch-settings-close"),
  addSetModal: document.getElementById("add-set-modal"),
  addSetClose: document.getElementById("add-set-close"),
  addSetBody: document.getElementById("add-set-body"),
  studentSetModal: document.getElementById("student-set-modal"),
  studentSetModalClose: document.getElementById("student-set-modal-close"),
  studentSetModalBody: document.getElementById("student-set-modal-body"),
  studentHomeLink: document.getElementById("student-home-link"),
  inputHomeLink: document.getElementById("input-home-link"),
  cardStage: document.getElementById("card-stage"),
  inputStage: document.getElementById("input-stage"),
  flashcard: document.getElementById("flashcard"),
  flashcardMotion: document.getElementById("flashcard-motion"),
  progressShell: document.getElementById("progress-shell"),
  progressLabel: document.getElementById("progress-label"),
  progressFill: document.getElementById("progress-fill"),
  flashcardMenuLogout: document.getElementById("flashcard-menu-logout"),
  flashcardSettingsShell: document.getElementById("flashcard-settings-shell"),
  flashcardSettingsButton: document.getElementById("flashcard-settings-button"),
  flashcardSettingsPopover: document.getElementById("flashcard-settings-popover"),
  learningDirectionButtons: document.querySelectorAll("[data-learning-direction]"),
  knownCounts: document.querySelectorAll("[data-known-count]"),
  unknownCounts: document.querySelectorAll("[data-unknown-count]"),
  audioButtons: document.querySelectorAll("[data-audio-button]"),
  evalButtons: document.querySelectorAll("[data-eval-button]"),
  frontContent: document.getElementById("front-content"),
  frontFace: document.getElementById("front-face"),
  backFace: document.getElementById("back-face"),
  cardAction: document.getElementById("card-action"),
  cardSecondaryAction: document.getElementById("card-secondary-action"),
  frontWord: document.getElementById("front-word"),
  frontAlternatives: document.getElementById("front-alternatives"),
  frontHint: document.getElementById("front-hint"),
  backWord: document.getElementById("back-word"),
  backVisual: document.getElementById("back-visual"),
  backAlternatives: document.getElementById("back-alternatives"),
  backHintShell: document.getElementById("back-hint-shell"),
  backHint: document.getElementById("back-hint"),
  statusMessage: document.getElementById("status-message"),
  inputProgressShell: document.getElementById("input-progress-shell"),
  inputProgressLabel: document.getElementById("input-progress-label"),
  inputProgressFill: document.getElementById("input-progress-fill"),
  inputMenuContext: document.getElementById("input-menu-context"),
  inputMenuLogout: document.getElementById("input-menu-logout"),
  inputSettingsShell: document.getElementById("input-settings-shell"),
  inputSettingsButton: document.getElementById("input-settings-button"),
  inputSettingsPopover: document.getElementById("input-settings-popover"),
  inputCorrectionToggle: document.getElementById("input-correction-toggle"),
  inputDelayTypeSwitch: document.getElementById("input-delay-type-switch"),
  inputDelayTypeCorrect: document.getElementById("input-delay-type-correct"),
  inputDelayTypeWrong: document.getElementById("input-delay-type-wrong"),
  inputDelaySlider: document.getElementById("input-delay-slider"),
  inputDelayValue: document.getElementById("input-delay-value"),
  inputPromptWord: document.getElementById("input-prompt-word"),
  inputPromptVisual: document.getElementById("input-prompt-visual"),
  inputPromptKicker: document.getElementById("input-prompt-kicker"),
  inputPromptDetail: document.getElementById("input-prompt-detail"),
  inputAnswerForm: document.getElementById("input-answer-form"),
  inputAnswerLabel: document.getElementById("input-answer-label"),
  inputAnswerRow: document.getElementById("input-answer-row"),
  inputAnswerField: document.getElementById("input-answer-field"),
  inputVerbAnswerFields: document.getElementById("input-verb-answer-fields"),
  inputVerbAnswerInputs: document.querySelectorAll("[data-irregular-verb-input]"),
  inputCheckButton: document.getElementById("input-check-button"),
  inputFeedback: document.getElementById("input-feedback"),
  inputFeedbackTitle: document.getElementById("input-feedback-title"),
  inputFeedbackInput: document.getElementById("input-feedback-input"),
  inputFeedbackCorrectRow: document.getElementById("input-feedback-correct-row"),
  inputFeedbackCorrect: document.getElementById("input-feedback-correct"),
  inputRevealAnswer: document.getElementById("input-reveal-answer"),
  inputStatusMessage: document.getElementById("input-status-message"),
  testStage: document.getElementById("test-stage"),
  testHomeLink: document.getElementById("test-home-link"),
  testMenuLogout: document.getElementById("test-menu-logout"),
  testStageTitle: document.getElementById("test-stage-title"),
  testFeedback: document.getElementById("test-feedback"),
  testFeedbackTitle: document.getElementById("test-feedback-title"),
  testFeedbackDetail: document.getElementById("test-feedback-detail"),
  testForm: document.getElementById("test-form"),
  testSourceLabel: document.getElementById("test-source-label"),
  testTargetLabel: document.getElementById("test-target-label"),
  testTableBody: document.getElementById("test-table-body"),
  testSubmit: document.getElementById("test-submit"),
  testStatusMessage: document.getElementById("test-status-message"),
};

let addSetScanner = null;
let addSetScanHandled = false;
let tabletDirectoryPromise = null;
const localSetMetadataCache = new Map();
const qrModuleCountCache = new Map();
let qrRenderSequence = 0;
const QR_PROBE_SIZE = 997;
let studentShareCopyResetTimerId = null;
let studentSetShareCopyResetTimerId = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  syncInputSettingsControls();
  void initializeStudentShareOrigin();
  void initializeStudentApp().finally(() => window.LerndeckPwa?.ready());
});

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
  elements.cardSecondaryAction.addEventListener("click", handleCardSecondaryAction);
  elements.cardSecondaryAction.addEventListener("pointerdown", handleControlPointerDown);
  elements.cardSecondaryAction.addEventListener("pointerup", stopControlEventPropagation);
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
  elements.studentShareBlock.addEventListener("click", handleStudentShareOverlayClick);
  elements.studentHomeLink.addEventListener("click", handleReturnToStudentHome);
  elements.inputHomeLink.addEventListener("click", handleReturnToStudentHome);
  elements.testHomeLink.addEventListener("click", handleReturnToStudentHome);
  elements.flashcardMenuLogout.addEventListener("click", handleFlashcardMenuLogout);
  elements.flashcardSettingsButton.addEventListener("click", handleFlashcardSettingsToggle);
  for (const directionButton of elements.learningDirectionButtons) {
    directionButton.addEventListener("click", handleLearningDirectionSelect);
  }
  elements.inputMenuLogout.addEventListener("click", handleInputMenuLogout);
  elements.testMenuLogout.addEventListener("click", handleInputMenuLogout);
  elements.inputSettingsButton.addEventListener("click", handleInputSettingsToggle);
  elements.inputCorrectionToggle?.addEventListener("change", handleInputCorrectionToggleChange);
  elements.inputDelayTypeCorrect.addEventListener("click", handleInputDelayTypeSelect);
  elements.inputDelayTypeWrong.addEventListener("click", handleInputDelayTypeSelect);
  elements.inputDelaySlider.addEventListener("input", handleInputDelaySliderChange);
  elements.launchModeStart.addEventListener("click", handleLaunchModeStart);
  elements.launchModeClose.addEventListener("click", closeLaunchModeModal);
  elements.launchModeModal.addEventListener("click", handleLaunchModeOverlayClick);
  elements.launchSettingsBack.addEventListener("click", returnToLaunchModeModal);
  elements.launchSettingsClose.addEventListener("click", closeLaunchModeModal);
  elements.launchSettingsStart.addEventListener("click", startPendingLaunchMode);
  elements.launchSettingsModal.addEventListener("click", handleLaunchSettingsOverlayClick);
  elements.inputAnswerForm.addEventListener("submit", handleInputAnswerSubmit);
  elements.testForm.addEventListener("submit", handleTestSubmit);
  elements.inputRevealAnswer.addEventListener("click", handleInputRevealAnswer);
  for (const input of elements.inputVerbAnswerInputs) {
    input.addEventListener("keydown", handleInputVerbFieldKeydown);
  }
  elements.addSetClose.addEventListener("click", closeAddSetModal);
  elements.addSetModal.addEventListener("click", handleAddSetModalOverlayClick);
  elements.studentSetModalClose.addEventListener("click", closeStudentSetModal);
  elements.studentSetModal.addEventListener("click", handleStudentSetModalOverlayClick);
  document.addEventListener("click", handleDocumentClick);
}

async function initializeStudentApp() {
  const setRequest = await resolveRequestedSetRequest();

  if (!setRequest.hasSetParam) {
    clearActiveLearningSession();
    state.requestedSetPath = "";
    state.requestedSetUrl = "";
    await continueStudentAccessFlow();
    return;
  }

  if (!setRequest.isValid) {
    renderStudentLoadErrorState({
      title: "Link ungültig",
      message: "Bitte Code oder Link prüfen.",
      detail: setRequest.detail || "",
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

async function startFlashcardSet(
  setPath,
  setUrl = new URL(setPath, getAppBaseUrl()).href,
  learningModeKey = DEFAULT_LEARNING_MODE_KEY,
  learningDirection = "",
) {
  state.currentSetPath = setPath;
  state.currentSetUrl = setUrl;
  state.currentSetBaseUrl = new URL("./", setUrl).href;
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  state.flashcardSettingsOpen = false;
  syncFlashcardSettingsControls();
  state.activeLearningModeKey = normalizeLearningModeKey(learningModeKey);
  state.activeLearningDirection = parseLearningDirection(learningDirection)
    || loadPreferredLearningDirection(setPath)
    || LEARNING_DIRECTIONS.SOURCE_TARGET;
  persistActiveLearningSession(
    setPath,
    state.activeLearningModeKey,
    APP_MODES.FLASHCARD,
    state.activeLearningDirection,
  );
  setStudentAppMode(APP_MODES.FLASHCARD);
  renderLoadingState();

  try {
    const data = await loadSet(setUrl);

    state.currentSetLanguageLabels = resolveSetLanguageLabels(data);
    if (!parseLearningDirection(learningDirection) && !loadPreferredLearningDirection(setPath)) {
      state.activeLearningDirection = normalizeLearningDirection(data?.set?.defaultDirections?.flashcard);
      persistPreferredLearningDirection(setPath, state.activeLearningDirection);
      persistActiveLearningSession(
        setPath,
        state.activeLearningModeKey,
        APP_MODES.FLASHCARD,
        state.activeLearningDirection,
      );
    }
    state.baseCards = buildCards(data);
    state.allCards = orientLearningCards(state.baseCards, state.activeLearningDirection);
    state.knownCount = 0;
    state.unknownCount = 0;
    syncFlashcardSettingsControls();
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

function createInputSessionState(cards = []) {
  return {
    cards: Array.isArray(cards) ? cards : [],
    currentIndex: 0,
    totalPoints: 0,
    awardedPointsForCurrentCard: 0,
    attemptCountForCurrentCard: 0,
    evaluation: null,
    scoredEvaluation: null,
    isComplete: false,
  };
}

function resetInputLearningState(cards = []) {
  clearInputAdvanceTimeout();
  state.inputSolutionRevealed = false;
  state.inputSession = createInputSessionState(cards);
}

function clearInputAdvanceTimeout() {
  if (state.inputAdvanceTimeoutId === null) {
    return;
  }

  window.clearTimeout(state.inputAdvanceTimeoutId);
  state.inputAdvanceTimeoutId = null;
}

function hasPendingInputAdvance() {
  return state.inputAdvanceTimeoutId !== null;
}

function getCurrentInputSessionCard(session = state.inputSession) {
  if (!session || session.isComplete || !Array.isArray(session.cards)) {
    return null;
  }

  return session.cards[session.currentIndex] || null;
}

function getInputEvaluationPoints(status, attemptCountBeforeCheck) {
  if (status === "correct") {
    return attemptCountBeforeCheck === 0 ? 2 : 1;
  }

  if (status === "almost") {
    return 1;
  }

  return 0;
}

function applyInputEvaluationToSession(session, evaluation, rawInput) {
  const nextEvaluation = {
    ...evaluation,
    rawInput,
  };
  const nextScoredEvaluation = session.scoredEvaluation || nextEvaluation;
  const isFirstAttempt = session.scoredEvaluation === null;
  const candidatePoints = isFirstAttempt
    ? getInputEvaluationPoints(evaluation.status, session.attemptCountForCurrentCard)
    : session.awardedPointsForCurrentCard;
  const nextAwardedPoints = isFirstAttempt
    ? Math.max(session.awardedPointsForCurrentCard, candidatePoints)
    : session.awardedPointsForCurrentCard;

  return {
    ...session,
    totalPoints: session.totalPoints + (nextAwardedPoints - session.awardedPointsForCurrentCard),
    awardedPointsForCurrentCard: nextAwardedPoints,
    attemptCountForCurrentCard: session.attemptCountForCurrentCard + 1,
    evaluation: nextEvaluation,
    scoredEvaluation: nextScoredEvaluation,
  };
}

function advanceInputSession(session) {
  const nextIndex = session.currentIndex + 1;

  if (nextIndex >= session.cards.length) {
    return {
      ...session,
      currentIndex: session.cards.length,
      awardedPointsForCurrentCard: 0,
      attemptCountForCurrentCard: 0,
      evaluation: null,
      scoredEvaluation: null,
      isComplete: true,
    };
  }

  return {
    ...session,
    currentIndex: nextIndex,
    awardedPointsForCurrentCard: 0,
    attemptCountForCurrentCard: 0,
    evaluation: null,
    scoredEvaluation: null,
  };
}

function getInputSessionMaxPoints(session = state.inputSession) {
  return Array.isArray(session?.cards) ? session.cards.length * 2 : 0;
}

function getInputSessionScorePercent(session = state.inputSession) {
  const maxPoints = getInputSessionMaxPoints(session);

  if (maxPoints < 1) {
    return null;
  }

  return Math.round((session.totalPoints / maxPoints) * 100);
}

function getInputStatusLabel(status) {
  if (status === "correct") {
    return "Richtig";
  }

  return "Falsch";
}

function formatInputLanguageLabel(code) {
  const normalizedCode = typeof code === "string" ? code.trim().toLowerCase() : "";

  if (normalizedCode === "de") {
    return "Deutsch";
  }

  if (normalizedCode === "en") {
    return "Englisch";
  }

  if (normalizedCode === "fr") {
    return "Französisch";
  }

  if (normalizedCode === "es") {
    return "Spanisch";
  }

  if (normalizedCode === "la") {
    return "Latein";
  }

  return normalizedCode ? normalizedCode.toUpperCase() : "";
}

function resolveSetLanguageLabels(data) {
  return {
    sourceLabel: typeof data?.set?.labels?.source === "string" && data.set.labels.source.trim()
      ? data.set.labels.source.trim()
      : formatInputLanguageLabel(data?.set?.languages?.source),
    targetLabel: typeof data?.set?.labels?.target === "string" && data.set.labels.target.trim()
      ? data.set.labels.target.trim()
      : formatInputLanguageLabel(data?.set?.languages?.target),
  };
}

function parseLearningDirection(value) {
  const normalizedValue = typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("_", "-").replaceAll("-to-", "-")
    : "";

  if (normalizedValue === LEARNING_DIRECTIONS.TARGET_SOURCE) {
    return LEARNING_DIRECTIONS.TARGET_SOURCE;
  }

  if (normalizedValue === LEARNING_DIRECTIONS.SOURCE_TARGET) {
    return LEARNING_DIRECTIONS.SOURCE_TARGET;
  }

  return "";
}

function normalizeLearningDirection(value) {
  return parseLearningDirection(value) || LEARNING_DIRECTIONS.SOURCE_TARGET;
}

function loadLearningDirectionPreferences() {
  try {
    const parsed = JSON.parse(loadPersistentStorageItem(LEARNING_DIRECTION_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Unable to load learning direction preferences:", error);
    return {};
  }
}

function loadPreferredLearningDirection(setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);
  return normalizedSetPath
    ? parseLearningDirection(loadLearningDirectionPreferences()[normalizedSetPath])
    : "";
}

function persistPreferredLearningDirection(setPath, direction) {
  const normalizedSetPath = normalizeSetPath(setPath);
  const normalizedDirection = parseLearningDirection(direction);

  if (!normalizedSetPath || !normalizedDirection) {
    return;
  }

  persistPersistentStorageItem(LEARNING_DIRECTION_STORAGE_KEY, JSON.stringify({
    ...loadLearningDirectionPreferences(),
    [normalizedSetPath]: normalizedDirection,
  }));
}

function getLearningDirectionLabels(labels = state.currentSetLanguageLabels) {
  return {
    sourceLabel: labels?.sourceLabel || "Vorderseite",
    targetLabel: labels?.targetLabel || "Rückseite",
  };
}

function getLearningDirectionLabel(direction, labels = state.currentSetLanguageLabels) {
  const resolvedLabels = getLearningDirectionLabels(labels);
  return normalizeLearningDirection(direction) === LEARNING_DIRECTIONS.TARGET_SOURCE
    ? `${resolvedLabels.targetLabel} → ${resolvedLabels.sourceLabel}`
    : `${resolvedLabels.sourceLabel} → ${resolvedLabels.targetLabel}`;
}

function getSubscriptionDirectionMetadata(subscription) {
  return {
    sourceLabel: typeof subscription?.sourceLabel === "string" ? subscription.sourceLabel.trim() : "",
    targetLabel: typeof subscription?.targetLabel === "string" ? subscription.targetLabel.trim() : "",
  };
}

function isDirectionConfigurableMode(modeKey) {
  return modeKey === "practice" || modeKey === "write" || modeKey === "test";
}

function syncLearningDirectionGroup(groupName, selectedDirection, labels) {
  const group = document.querySelector(`[data-learning-direction-group="${groupName}"]`);

  if (!(group instanceof HTMLElement)) {
    return;
  }

  for (const button of group.querySelectorAll("[data-learning-direction]")) {
    const direction = normalizeLearningDirection(button.dataset.learningDirection);
    const isSelected = direction === normalizeLearningDirection(selectedDirection);
    button.textContent = getLearningDirectionLabel(direction, labels);
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function syncFlashcardSettingsControls() {
  const isOpen = state.flashcardSettingsOpen;
  const isReady = state.baseCards.length > 0;
  elements.flashcardSettingsShell?.setAttribute("data-open", String(isOpen));
  elements.flashcardSettingsButton?.setAttribute("aria-expanded", String(isOpen));
  elements.flashcardSettingsButton?.setAttribute("aria-label", isOpen ? "Einstellungen schließen" : "Einstellungen öffnen");
  if (elements.flashcardSettingsButton instanceof HTMLButtonElement) {
    elements.flashcardSettingsButton.disabled = !isReady;
  }
  elements.flashcardSettingsPopover?.setAttribute("aria-hidden", String(!isOpen));
  syncLearningDirectionGroup("flashcard", state.activeLearningDirection, state.currentSetLanguageLabels);
}

function closeFlashcardSettingsMenu() {
  if (!state.flashcardSettingsOpen) {
    return;
  }

  state.flashcardSettingsOpen = false;
  syncFlashcardSettingsControls();
}

function toggleFlashcardSettingsMenu() {
  state.flashcardSettingsOpen = !state.flashcardSettingsOpen;
  syncFlashcardSettingsControls();
}

function getInputDirectionLabel() {
  const sourceLabel = state.currentSetLanguageLabels?.sourceLabel || "";
  const targetLabel = state.currentSetLanguageLabels?.targetLabel || "";

  if (sourceLabel && targetLabel) {
    return `${sourceLabel} → ${targetLabel}`;
  }

  return "";
}

function getInputAnswerLabelText(card = getCurrentInputSessionCard()) {
  if (hasIrregularVerbAnswer(card)) {
    return "Drei Verbformen";
  }

  const sourceLabel = state.currentSetLanguageLabels?.sourceLabel || "";
  const targetLabel = state.currentSetLanguageLabels?.targetLabel || "";

  if (sourceLabel && targetLabel) {
    return `${sourceLabel}-${targetLabel}`;
  }

  return "Deine Antwort";
}

function getIrregularVerbForms(value) {
  return window.LerndeckIrregularVerbs.parseForms(value);
}

function hasIrregularVerbAnswer(card) {
  return Array.isArray(card?.irregularVerbAnswerGroups)
    && card.irregularVerbAnswerGroups.length === window.LerndeckIrregularVerbs.FORM_LABELS.length;
}

function renderLearningTerm(element, value) {
  const text = typeof value === "string" ? value.trim() : "";
  const forms = getIrregularVerbForms(text);
  element.replaceChildren();
  element.classList.toggle("has-irregular-verb", Boolean(forms));
  element.classList.remove("is-single-term", "has-paired-term-size");
  element.style.removeProperty("--learning-term-max-size");
  element.style.removeProperty("--learning-term-paired-max-size");

  if (!forms) {
    const isSingleTerm = Boolean(text) && !/\s/u.test(text);
    element.classList.toggle("is-single-term", isSingleTerm);
    if (isSingleTerm) {
      const maxSizeRem = getLearningTermMaxSizeRem(text);
      element.style.setProperty("--learning-term-max-size", `${maxSizeRem.toFixed(3)}rem`);
    }
    element.textContent = text || "\u00a0";
    element.removeAttribute("aria-label");
    return;
  }

  const term = document.createElement("span");
  term.className = "irregular-verb-term";
  term.setAttribute("aria-hidden", "true");

  const primary = document.createElement("strong");
  primary.className = "irregular-verb-term__primary";
  primary.textContent = forms[0];

  const secondary = document.createElement("span");
  secondary.className = "irregular-verb-term__secondary";
  for (const index of [1, 2]) {
    const form = document.createElement("span");
    form.className = "irregular-verb-term__form";
    const label = document.createElement("small");
    label.textContent = window.LerndeckIrregularVerbs.FORM_LABELS[index];
    const formValue = document.createElement("span");
    formValue.textContent = forms[index];
    form.append(label, formValue);
    secondary.append(form);
  }

  term.append(primary, secondary);
  element.append(term);
  element.setAttribute(
    "aria-label",
    window.LerndeckIrregularVerbs.FORM_LABELS
      .map((label, index) => `${label}: ${forms[index]}`)
      .join(", "),
  );
}

function getLearningTermMaxSizeRem(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /\s/u.test(text) || getIrregularVerbForms(text)) {
    return 4;
  }

  const characterCount = Array.from(text).length;
  return Math.min(Math.max(32 / (characterCount * 0.55), 1.7), 4);
}

function syncFlashcardPairTypography(card) {
  const words = [elements.frontWord, elements.backWord];
  const visualSizeLimit = card?.visual?.url ? 3.4 : 4;
  const pairedMaxSizeRem = Math.min(
    visualSizeLimit,
    getLearningTermMaxSizeRem(card?.sourceText),
    getLearningTermMaxSizeRem(card?.targetText),
  );

  for (const word of words) {
    word.classList.add("has-paired-term-size");
    word.style.setProperty(
      "--learning-term-paired-max-size",
      `${pairedMaxSizeRem.toFixed(3)}rem`,
    );
  }
}

function formatLearningTermInline(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const forms = getIrregularVerbForms(text);
  return forms ? forms.join(" · ") : text;
}

function buildInputPromptDetail(card) {
  return "";
}

function getInputVerbFields() {
  return Array.from(elements.inputVerbAnswerInputs || []);
}

function configureInputAnswerFields(card) {
  const usesVerbFields = hasIrregularVerbAnswer(card);
  elements.inputAnswerField.hidden = usesVerbFields;
  elements.inputVerbAnswerFields.hidden = !usesVerbFields;
  elements.inputAnswerRow.classList.toggle("has-irregular-verb", usesVerbFields);
  if (usesVerbFields) {
    elements.inputAnswerLabel.removeAttribute("for");
  } else {
    elements.inputAnswerLabel.setAttribute("for", "input-answer-field");
  }
  return usesVerbFields;
}

function clearInputAnswerFields() {
  elements.inputAnswerField.value = "";
  for (const input of getInputVerbFields()) {
    input.value = "";
    const field = input.closest(".input-stage__verb-field");
    field?.removeAttribute("data-evaluation");
  }
}

function getInputAnswerValues(card) {
  return hasIrregularVerbAnswer(card)
    ? getInputVerbFields().map((input) => input.value)
    : [elements.inputAnswerField.value];
}

function restoreInputAnswerValues(card, evaluation) {
  if (hasIrregularVerbAnswer(card)) {
    const values = Array.isArray(evaluation?.rawInputs) ? evaluation.rawInputs : [];
    getInputVerbFields().forEach((input, index) => {
      input.value = values[index] || "";
    });
    return;
  }

  elements.inputAnswerField.value = evaluation?.rawInput || "";
}

function updateInputFieldEvaluation(card, evaluation) {
  if (!hasIrregularVerbAnswer(card)) {
    return;
  }

  const fieldEvaluations = Array.isArray(evaluation?.fieldEvaluations)
    ? evaluation.fieldEvaluations
    : [];
  getInputVerbFields().forEach((input, index) => {
    const field = input.closest(".input-stage__verb-field");
    const status = fieldEvaluations[index]?.status;
    if (field && ["correct", "almost", "wrong"].includes(status)) {
      field.dataset.evaluation = status;
    } else {
      field?.removeAttribute("data-evaluation");
    }
  });
}

function setInputAnswerFieldsLocked(card, isLocked) {
  const inputs = hasIrregularVerbAnswer(card)
    ? getInputVerbFields()
    : [elements.inputAnswerField];
  for (const input of inputs) {
    input.disabled = isLocked;
    input.readOnly = isLocked;
  }
}

function focusFirstInputAnswerField(card) {
  const inputs = hasIrregularVerbAnswer(card)
    ? getInputVerbFields()
    : [elements.inputAnswerField];
  const target = inputs.find((input) => !input.disabled && !input.value.trim())
    || inputs.find((input) => !input.disabled);
  target?.focus();
}

function formatInputEvaluationValue(evaluation) {
  return evaluation?.rawInput?.trim() || "Leer";
}

function getInputFeedbackTone(status) {
  return status === "correct" ? "correct" : "wrong";
}

function getInputAdvanceDelay(status) {
  return status === "correct"
    ? state.inputCorrectAdvanceDelayMs
    : state.inputIncorrectAdvanceDelayMs;
}

function clampInputAdvanceDelay(delayMs, maxDelayMs) {
  if (!Number.isFinite(delayMs)) {
    return 0;
  }

  const clampedValue = Math.min(Math.max(delayMs, 0), maxDelayMs);
  return Math.round(clampedValue / INPUT_ADVANCE_DELAY_STEP_MS) * INPUT_ADVANCE_DELAY_STEP_MS;
}

function formatInputAdvanceDelay(delayMs) {
  if (delayMs <= 0) {
    return "sofort";
  }

  const seconds = Math.max(delayMs, 0) / 1000;

  if (Math.abs(seconds - Math.round(seconds)) < 0.001) {
    return `${Math.round(seconds)} s`;
  }

  return `${seconds.toFixed(1)} s`;
}

function getInputDelayPresets(delayType = state.inputDelayEditorType) {
  return delayType === "wrong"
    ? INPUT_DELAY_PRESETS.wrong
    : INPUT_DELAY_PRESETS.correct;
}

function resolveInputDelayPresetIndex(delayType, delayMs) {
  const presets = getInputDelayPresets(delayType);
  const matchedIndex = presets.findIndex((preset) => preset.delayMs === delayMs);

  if (matchedIndex >= 0) {
    return matchedIndex;
  }

  let closestIndex = 0;
  let closestDistance = Math.abs(presets[0].delayMs - delayMs);

  for (let index = 1; index < presets.length; index += 1) {
    const distance = Math.abs(presets[index].delayMs - delayMs);
    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  }

  return closestIndex;
}

function getInputDelayEditorLimits(delayType = state.inputDelayEditorType) {
  const normalizedDelayType = delayType === "wrong" ? "wrong" : "correct";
  const currentDelayMs = normalizedDelayType === "wrong"
    ? state.inputIncorrectAdvanceDelayMs
    : state.inputCorrectAdvanceDelayMs;
  const presets = getInputDelayPresets(normalizedDelayType);
  const presetIndex = resolveInputDelayPresetIndex(normalizedDelayType, currentDelayMs);

  return {
    value: presetIndex,
    max: presets.length - 1,
    label: normalizedDelayType === "wrong"
      ? "Anzeigezeit für falsche Antworten"
      : "Anzeigezeit für richtige Antworten",
    preset: presets[presetIndex],
  };
}

function getInputScoredEvaluation(session = state.inputSession) {
  return session?.scoredEvaluation || null;
}

function isInputCorrectionRequired(session = state.inputSession) {
  const scoredEvaluation = getInputScoredEvaluation(session);
  const latestEvaluation = session?.evaluation;

  return Boolean(
    state.inputCorrectionModeEnabled
      && scoredEvaluation
      && latestEvaluation
      && getInputFeedbackTone(scoredEvaluation.status) === "wrong"
      && latestEvaluation.status !== "correct",
  );
}

function isInputCorrectionCompleted(session = state.inputSession) {
  const scoredEvaluation = getInputScoredEvaluation(session);
  const latestEvaluation = session?.evaluation;

  return Boolean(
    scoredEvaluation
      && latestEvaluation
      && getInputFeedbackTone(scoredEvaluation.status) === "wrong"
      && latestEvaluation.status === "correct",
  );
}

function syncInputSettingsControls() {
  if (!(elements.inputSettingsButton instanceof HTMLElement)) {
    return;
  }

  const isOpen = state.inputSettingsOpen;
  elements.inputSettingsShell?.setAttribute("data-open", String(isOpen));
  elements.inputSettingsButton.setAttribute("aria-expanded", String(isOpen));
  elements.inputSettingsButton.setAttribute("aria-label", isOpen ? "Einstellungen schließen" : "Einstellungen öffnen");
  elements.inputSettingsPopover?.setAttribute("aria-hidden", String(!isOpen));
  syncLearningDirectionGroup("input", state.activeLearningDirection, state.currentSetLanguageLabels);

  if (elements.inputCorrectionToggle instanceof HTMLInputElement) {
    elements.inputCorrectionToggle.checked = state.inputCorrectionModeEnabled;
  }

  const delayEditorType = state.inputDelayEditorType === "wrong" ? "wrong" : "correct";
  const delayEditorConfig = getInputDelayEditorLimits(delayEditorType);

  elements.inputSettingsPopover?.setAttribute("data-delay-type", delayEditorType);

  if (elements.inputDelayTypeCorrect instanceof HTMLButtonElement) {
    const isActive = delayEditorType === "correct";
    elements.inputDelayTypeCorrect.setAttribute("aria-selected", String(isActive));
    elements.inputDelayTypeCorrect.dataset.active = String(isActive);
    elements.inputDelayTypeCorrect.tabIndex = isActive ? 0 : -1;
  }

  if (elements.inputDelayTypeWrong instanceof HTMLButtonElement) {
    const isActive = delayEditorType === "wrong";
    elements.inputDelayTypeWrong.setAttribute("aria-selected", String(isActive));
    elements.inputDelayTypeWrong.dataset.active = String(isActive);
    elements.inputDelayTypeWrong.tabIndex = isActive ? 0 : -1;
  }

  if (elements.inputDelaySlider instanceof HTMLInputElement) {
    elements.inputDelaySlider.max = String(delayEditorConfig.max);
    elements.inputDelaySlider.value = String(delayEditorConfig.value);
    elements.inputDelaySlider.min = "0";
    elements.inputDelaySlider.step = "1";
    elements.inputDelaySlider.setAttribute("aria-label", delayEditorConfig.label);
  }

  if (elements.inputDelayValue instanceof HTMLOutputElement) {
    elements.inputDelayValue.value = delayEditorConfig.preset.label;
    elements.inputDelayValue.textContent = elements.inputDelayValue.value;
  }
}

function closeInputSettingsMenu() {
  if (!state.inputSettingsOpen) {
    return;
  }

  state.inputSettingsOpen = false;
  syncInputSettingsControls();
}

function openInputSettingsMenu() {
  if (state.inputSettingsOpen) {
    return;
  }

  state.inputSettingsOpen = true;
  syncInputSettingsControls();
}

function toggleInputSettingsMenu() {
  state.inputSettingsOpen = !state.inputSettingsOpen;
  syncInputSettingsControls();
}

function applyInputSettingsToCurrentSession() {
  syncInputSettingsControls();

  if (state.appMode !== APP_MODES.INPUT) {
    clearInputAdvanceTimeout();
    return;
  }

  if (state.inputSession.isComplete || !state.inputSession.evaluation) {
    clearInputAdvanceTimeout();
    renderInputSession();
    return;
  }

  renderInputSession();
  scheduleInputAdvance(state.inputSession.evaluation);
}

function scheduleInputAdvance(evaluation) {
  if (!evaluation || state.inputSession.isComplete || isInputCorrectionRequired(state.inputSession)) {
    clearInputAdvanceTimeout();
    return;
  }

  clearInputAdvanceTimeout();
  state.inputAdvanceTimeoutId = window.setTimeout(() => {
    state.inputAdvanceTimeoutId = null;
    void handleInputAdvance();
  }, getInputAdvanceDelay(getInputFeedbackTone(evaluation.status)));
}

function renderInputMenuContext() {
  syncInputSettingsControls();
}

function updateInputStageSummary() {
  const session = state.inputSession;
  const totalCards = Array.isArray(session.cards) ? session.cards.length : 0;
  const currentCardNumber = totalCards > 0
    ? (session.isComplete ? totalCards : session.currentIndex + 1)
    : 0;
  const progressPercent = totalCards > 0
    ? Math.round((currentCardNumber / totalCards) * 100)
    : 0;

  renderInputMenuContext();
  elements.inputProgressShell.setAttribute("aria-hidden", String(totalCards < 1));
  elements.inputProgressLabel.textContent = totalCards < 1
    ? ""
    : `${currentCardNumber} von ${totalCards}`;
  updateProgressFillAnimation(elements.inputProgressFill, progressPercent);
}

function renderInputEvaluation(session = state.inputSession) {
  const evaluation = session?.evaluation;

  if (!evaluation) {
    elements.inputFeedback.classList.remove("is-visible");
    elements.inputFeedback.classList.remove("is-correct", "is-wrong");
    elements.inputFeedback.setAttribute("aria-hidden", "true");
    elements.inputFeedbackTitle.textContent = "";
    elements.inputFeedbackInput.textContent = "";
    elements.inputFeedbackCorrectRow.hidden = true;
    elements.inputFeedbackCorrect.textContent = "";
    elements.inputRevealAnswer.hidden = true;
    return;
  }

  const correctionRequired = isInputCorrectionRequired(session);
  const correctionCompleted = isInputCorrectionCompleted(session);
  const feedbackTone = correctionRequired ? "wrong" : getInputFeedbackTone(evaluation.status);
  elements.inputFeedback.classList.add("is-visible");
  elements.inputFeedback.classList.toggle("is-correct", feedbackTone === "correct");
  elements.inputFeedback.classList.toggle("is-wrong", feedbackTone === "wrong");
  elements.inputFeedback.setAttribute("aria-hidden", "false");
  elements.inputFeedbackTitle.textContent = correctionRequired
    ? "Noch nicht korrekt"
    : correctionCompleted
      ? "Korrigiert"
      : feedbackTone === "correct"
        ? "Richtig"
        : "Falsch";
  elements.inputFeedbackInput.textContent = formatInputEvaluationValue(evaluation);
  const canRevealAnswer = correctionRequired && !state.inputSolutionRevealed;
  elements.inputFeedbackCorrectRow.hidden = feedbackTone === "correct"
    || (correctionRequired && !state.inputSolutionRevealed);
  elements.inputFeedbackCorrect.textContent = evaluation.bestAnswer || "—";
  elements.inputRevealAnswer.hidden = !canRevealAnswer;
}

function renderInputCompletionState() {
  renderInputVisual(null, false);
  const scorePercent = getInputSessionScorePercent();
  elements.inputPromptKicker.textContent = "";
  renderLearningTerm(elements.inputPromptWord, "Fertig");
  elements.inputPromptDetail.textContent = scorePercent === null
    ? "Keine Karten im Durchgang. Enter startet einen neuen Durchgang."
    : `${state.inputSession.totalPoints} von ${getInputSessionMaxPoints(state.inputSession)} Punkten · ${scorePercent} % · Enter startet neu.`;
  elements.inputAnswerForm.hidden = true;
  elements.inputAnswerLabel.hidden = false;
  configureInputAnswerFields(null);
  elements.inputCheckButton.hidden = false;
  if (elements.inputAnswerRow instanceof HTMLElement) {
    delete elements.inputAnswerRow.dataset.state;
  }
  if (elements.inputAnswerLabel instanceof HTMLElement) {
    delete elements.inputAnswerLabel.dataset.state;
  }
  if (elements.inputCheckButton instanceof HTMLElement) {
    delete elements.inputCheckButton.dataset.iconMode;
    elements.inputCheckButton.setAttribute("aria-label", "Antwort prüfen");
  }
  renderInputEvaluation(null);
  elements.inputStatusMessage.textContent = scorePercent === null
    ? "Eingabe abgeschlossen."
    : `Eingabe abgeschlossen. ${state.inputSession.totalPoints} Punkte, ${scorePercent} Prozent. Enter startet neu.`;
}

function renderInputSession() {
  const session = state.inputSession;
  updateInputStageSummary();

  if (session.isComplete) {
    renderInputCompletionState();
    return;
  }

  const card = getCurrentInputSessionCard(session);
  const evaluation = session.evaluation;
  const correctionRequired = isInputCorrectionRequired(session);
  const correctionCompleted = isInputCorrectionCompleted(session);
  const hasLockedFeedback = Boolean(evaluation) && !correctionRequired;

  if (!card) {
    renderInputCompletionState();
    return;
  }

  elements.inputPromptKicker.textContent = "";
  renderLearningTerm(elements.inputPromptWord, card.sourceText);
  renderInputVisual(card, Boolean(evaluation));
  elements.inputPromptDetail.textContent = buildInputPromptDetail(card);
  elements.inputAnswerForm.hidden = false;
  elements.inputAnswerLabel.hidden = false;
  const usesVerbFields = configureInputAnswerFields(card);
  elements.inputAnswerLabel.textContent = getInputAnswerLabelText(card);
  if (!evaluation && session.attemptCountForCurrentCard === 0) {
    clearInputAnswerFields();
  } else if (hasLockedFeedback && evaluation) {
    restoreInputAnswerValues(card, evaluation);
  }
  setInputAnswerFieldsLocked(card, hasLockedFeedback);
  updateInputFieldEvaluation(card, evaluation);
  elements.inputCheckButton.hidden = hasLockedFeedback;
  elements.inputCheckButton.disabled = hasLockedFeedback;
  elements.inputAnswerRow.dataset.state = correctionRequired ? "rewrite" : "";
  elements.inputAnswerLabel.dataset.state = correctionRequired ? "rewrite" : "";
  elements.inputCheckButton.dataset.iconMode = correctionRequired ? "rewrite" : "submit";
  elements.inputCheckButton.setAttribute("aria-label", correctionRequired ? "Antwort noch einmal eingeben" : "Antwort prüfen");

  renderInputEvaluation(session);

  if (!hasLockedFeedback) {
    const currentInputs = usesVerbFields ? getInputVerbFields() : [elements.inputAnswerField];
    const shouldFocusInput = !currentInputs.includes(document.activeElement);
    if (shouldFocusInput) {
      focusFirstInputAnswerField(card);
    }
  }

  elements.inputStatusMessage.textContent = evaluation
    ? correctionRequired
      ? `Erste Eingabe als Fehler gewertet. ${formatInputEvaluationValue(evaluation)} war noch nicht korrekt. Gib jetzt die richtige Lösung ein.`
      : correctionCompleted
        ? `Korrektur geschafft. Die erste Eingabe bleibt als Fehler gewertet. ${getInputAdvanceDelay("correct") === 0 ? "Nächste Karte wird direkt geladen." : `Nächste Karte in ${formatInputAdvanceDelay(getInputAdvanceDelay("correct"))}.`}`
        : `${getInputStatusLabel(evaluation.status)}. Eingabe ${formatInputEvaluationValue(evaluation)}.${getInputFeedbackTone(evaluation.status) === "wrong" ? ` Richtige Lösung ${evaluation.bestAnswer || "unbekannt"}.` : ""} ${getInputAdvanceDelay(getInputFeedbackTone(evaluation.status)) === 0 ? "Nächste Karte wird direkt geladen." : `Nächste Karte in ${formatInputAdvanceDelay(getInputAdvanceDelay(getInputFeedbackTone(evaluation.status)))}.`}`
    : `Karte ${session.currentIndex + 1} von ${session.cards.length}. ${formatLearningTermInline(card.sourceText)}.`;
}

async function finishInputSession() {
  clearInputAdvanceTimeout();
  const nextSession = advanceInputSession(state.inputSession);
  state.inputSession = nextSession;
  renderInputSession();

  const scorePercent = getInputSessionScorePercent(nextSession);
  await persistCompletedRoundCount({
    modeKey: state.activeLearningModeKey || "write",
    lastRoundPercent: scorePercent,
  });
}

async function startInputSet(
  setPath,
  setUrl = new URL(setPath, getAppBaseUrl()).href,
  learningModeKey = "write",
  learningDirection = "",
) {
  state.currentSetPath = setPath;
  state.currentSetUrl = setUrl;
  state.currentSetBaseUrl = new URL("./", setUrl).href;
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  state.activeLearningModeKey = normalizeLearningModeKey(learningModeKey);
  state.activeLearningDirection = parseLearningDirection(learningDirection)
    || loadPreferredLearningDirection(setPath)
    || LEARNING_DIRECTIONS.SOURCE_TARGET;
  persistActiveLearningSession(
    setPath,
    state.activeLearningModeKey,
    APP_MODES.INPUT,
    state.activeLearningDirection,
  );
  setStudentAppMode(APP_MODES.INPUT);
  resetInputLearningState();
  clearInputAnswerFields();
  elements.inputPromptKicker.textContent = "";
  renderLearningTerm(elements.inputPromptWord, "Lädt");
  renderInputVisual(null, false);
  elements.inputPromptDetail.textContent = "Set wird geöffnet.";
  elements.inputAnswerForm.hidden = true;
  renderInputEvaluation(null);
  updateInputStageSummary();

  try {
    const data = await loadSet(setUrl);
    state.currentSetLanguageLabels = resolveSetLanguageLabels(data);
    if (!parseLearningDirection(learningDirection) && !loadPreferredLearningDirection(setPath)) {
      state.activeLearningDirection = normalizeLearningDirection(data?.set?.defaultDirections?.flashcard);
      persistPreferredLearningDirection(setPath, state.activeLearningDirection);
      persistActiveLearningSession(
        setPath,
        state.activeLearningModeKey,
        APP_MODES.INPUT,
        state.activeLearningDirection,
      );
    }
    state.baseCards = buildCards(data);
    state.allCards = orientLearningCards(state.baseCards, state.activeLearningDirection);
    syncInputSettingsControls();
    resetInputLearningState(state.allCards);
    renderInputSession();
  } catch (error) {
    console.error("Unable to start input set:", error);
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

function createTestSessionState(cards = []) {
  return {
    cards: Array.isArray(cards) ? cards : [],
    evaluations: {},
    initialCorrectCount: null,
    initialWrongCount: null,
    checkCount: 0,
    isComplete: false,
  };
}

function shuffleCards(cards) {
  const shuffledCards = [...cards];

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledCards[index], shuffledCards[randomIndex]] = [shuffledCards[randomIndex], shuffledCards[index]];
  }

  if (
    shuffledCards.length > 1
    && shuffledCards.every((card, index) => card === cards[index])
  ) {
    [shuffledCards[0], shuffledCards[1]] = [shuffledCards[1], shuffledCards[0]];
  }

  return shuffledCards;
}

function selectRandomTestCards(cards, requestedCount) {
  const count = clamp(Math.floor(requestedCount), 1, cards.length);
  return shuffleCards(cards).slice(0, count);
}

function resetTestLearningState(cards = []) {
  state.testSession = createTestSessionState(cards);
}

function getTestEvaluationCounts(session = state.testSession) {
  const evaluations = Object.values(session.evaluations || {});
  return {
    correctCount: evaluations.filter((evaluation) => evaluation?.status === "correct").length,
    wrongCount: evaluations.filter((evaluation) => evaluation?.status === "wrong").length,
  };
}

function createTestTableRow(card, index) {
  const evaluation = state.testSession.evaluations[index] || null;
  const row = document.createElement("tr");
  row.className = "test-stage__row";
  row.classList.toggle("is-wrong", evaluation?.status === "wrong");
  row.classList.toggle("is-correct", evaluation?.status === "correct");

  const numberCell = document.createElement("th");
  numberCell.className = "test-stage__number";
  numberCell.scope = "row";
  numberCell.textContent = String(index + 1);

  const promptCell = document.createElement("td");
  promptCell.className = "test-stage__prompt";
  promptCell.textContent = card.sourceText;

  const answerCell = document.createElement("td");
  answerCell.className = "test-stage__answer";
  const input = document.createElement("input");
  input.className = "test-stage__input";
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "none";
  input.spellcheck = false;
  input.required = true;
  input.dataset.testAnswerIndex = String(index);
  input.setAttribute("aria-label", `Antwort für ${card.sourceText}`);
  input.value = evaluation?.input || "";
  input.readOnly = evaluation?.status === "correct" || state.testSession.isComplete;
  if (evaluation?.status === "wrong") {
    input.setAttribute("aria-invalid", "true");
  }
  answerCell.append(input);

  row.append(numberCell, promptCell, answerCell);
  return row;
}

function renderTestSession({ focusWrongAnswer = false } = {}) {
  const session = state.testSession;
  const labels = getLearningDirectionLabels();
  const usesReverseDirection = state.activeLearningDirection === LEARNING_DIRECTIONS.TARGET_SOURCE;
  elements.testSourceLabel.textContent = usesReverseDirection ? labels.targetLabel : labels.sourceLabel;
  elements.testTargetLabel.textContent = usesReverseDirection ? labels.sourceLabel : labels.targetLabel;
  elements.testTableBody.replaceChildren(
    ...session.cards.map((card, index) => createTestTableRow(card, index)),
  );

  const hasEvaluation = session.checkCount > 0;
  const { correctCount, wrongCount } = getTestEvaluationCounts(session);
  elements.testFeedback.hidden = !hasEvaluation;
  elements.testFeedback.classList.toggle("is-complete", session.isComplete);
  elements.testFeedbackTitle.textContent = session.isComplete
    ? "Alles richtig"
    : `${correctCount} richtig · ${wrongCount} falsch`;
  elements.testFeedbackDetail.textContent = session.isComplete
    ? `${session.cards.length} von ${session.cards.length} Antworten stimmen.`
    : "Verbessere die rot markierten Antworten und prüfe erneut.";
  elements.testSubmit.textContent = session.isComplete
    ? "Neuen Test starten"
    : hasEvaluation
      ? "Erneut prüfen"
      : "Antworten prüfen";

  elements.testStatusMessage.textContent = session.isComplete
    ? `Test abgeschlossen. Alle ${session.cards.length} Antworten sind richtig.`
    : hasEvaluation
      ? `${correctCount} richtig, ${wrongCount} falsch. Korrigiere die rot markierten Antworten.`
      : `Test mit ${session.cards.length} Vokabeln. Fülle alle Antworten aus.`;

  if (focusWrongAnswer) {
    const firstWrongInput = elements.testTableBody.querySelector(".test-stage__row.is-wrong .test-stage__input");
    firstWrongInput?.focus();
    firstWrongInput?.select();
  }
}

function startNewTestRound() {
  const selectedCards = selectRandomTestCards(state.allCards, state.activeTestCardCount);
  resetTestLearningState(selectedCards);
  renderTestSession();
  elements.testTableBody.querySelector(".test-stage__input")?.focus();
}

async function handleTestSubmit(event) {
  event.preventDefault();

  if (state.testSession.isComplete) {
    startNewTestRound();
    return;
  }

  const previousEvaluations = state.testSession.evaluations;
  const nextEvaluations = { ...previousEvaluations };

  for (const [index, card] of state.testSession.cards.entries()) {
    if (previousEvaluations[index]?.status === "correct") {
      continue;
    }

    const input = elements.testTableBody.querySelector(`[data-test-answer-index="${index}"]`);
    const rawInput = input instanceof HTMLInputElement ? input.value.trim() : "";
    const evaluation = evaluateInputAnswer(rawInput, card.answers);
    nextEvaluations[index] = {
      status: evaluation.status === "correct" ? "correct" : "wrong",
      input: rawInput,
    };
  }

  const nextCheckCount = state.testSession.checkCount + 1;
  const counts = getTestEvaluationCounts({ evaluations: nextEvaluations });
  const isComplete = counts.wrongCount === 0;
  const isFirstCheck = state.testSession.checkCount === 0;
  state.testSession = {
    ...state.testSession,
    evaluations: nextEvaluations,
    initialCorrectCount: isFirstCheck ? counts.correctCount : state.testSession.initialCorrectCount,
    initialWrongCount: isFirstCheck ? counts.wrongCount : state.testSession.initialWrongCount,
    checkCount: nextCheckCount,
    isComplete,
  };
  renderTestSession({ focusWrongAnswer: !isComplete });

  if (isFirstCheck) {
    const initialPercent = getRoundResultPercent(state.testSession.cards.length, counts.wrongCount);
    await persistCompletedRoundCount({
      modeKey: "test",
      lastRoundPercent: initialPercent,
    });
  }
}

async function startTestSet(
  setPath,
  setUrl = new URL(setPath, getAppBaseUrl()).href,
  learningDirection = "",
  requestedCardCount = TEST_DEFAULT_CARD_COUNT,
) {
  const normalizedRequestedCardCount = Math.max(1, Math.floor(requestedCardCount));
  state.currentSetPath = setPath;
  state.currentSetUrl = setUrl;
  state.currentSetBaseUrl = new URL("./", setUrl).href;
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  state.activeLearningModeKey = "test";
  state.activeLearningDirection = parseLearningDirection(learningDirection)
    || loadPreferredLearningDirection(setPath)
    || LEARNING_DIRECTIONS.SOURCE_TARGET;
  state.activeTestCardCount = normalizedRequestedCardCount;
  persistActiveLearningSession(
    setPath,
    "test",
    APP_MODES.TEST,
    state.activeLearningDirection,
    state.activeTestCardCount,
  );
  setStudentAppMode(APP_MODES.TEST);
  state.activeTestCardCount = normalizedRequestedCardCount;
  resetTestLearningState();
  elements.testStageTitle.textContent = state.pendingLaunchSetTitle || "Vokabeltest";
  elements.testSourceLabel.textContent = "Vokabel";
  elements.testTargetLabel.textContent = "Antwort";
  elements.testTableBody.replaceChildren();
  elements.testFeedback.hidden = true;
  elements.testSubmit.textContent = "Antworten prüfen";
  elements.testStatusMessage.textContent = "Set wird geöffnet.";

  try {
    const data = await loadSet(setUrl);
    state.currentSetLanguageLabels = resolveSetLanguageLabels(data);
    state.baseCards = buildCards(data);
    state.allCards = orientLearningCards(state.baseCards, state.activeLearningDirection);
    state.activeTestCardCount = clamp(
      state.activeTestCardCount,
      Math.min(TEST_MIN_CARD_COUNT, state.allCards.length),
      state.allCards.length,
    );
    elements.testStageTitle.textContent = data?.set?.title || "Vokabeltest";
    persistActiveLearningSession(
      setPath,
      "test",
      APP_MODES.TEST,
      state.activeLearningDirection,
      state.activeTestCardCount,
    );
    startNewTestRound();
  } catch (error) {
    console.error("Unable to start test set:", error);
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
  state.accessSelectedFlow = "";
  state.accessIntroVariantIndex = Math.floor(Math.random() * ACCESS_INTRO_VARIANTS.length);
  await ensureTabletDirectoryLoaded();
  await ensureAccessSessionLoaded();

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
      clearActiveLearningSession();
      clearLocalTabletId();
      clearStudentSessionUnlock();
      clearTabletSession();
      clearActiveTabletContext();
      resetTabletDirectoryCache();
      await ensureTabletDirectoryLoaded();
      renderAccessState({
        loginTabletId: "",
        registrationTabletId: tabletId,
        registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Decks und ohne Lernstände.",
        showRegistration: true,
      });
      return;
    }

    if (setIntent.authRequired) {
      return;
    }

    if (setIntent.isSubscribed && await resumeActiveLearningSession(requestedSetPath)) {
      return;
    }

    const subscriptionResult = await subscribeTabletToSet(tabletId, requestedSetPath);

    if (subscriptionResult.authRequired) {
      return;
    }

    if (!subscriptionResult.ok) {
      renderStudentLoadErrorState({
        title: "Deck konnte nicht hinzugefügt werden",
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
    nextUrl.searchParams.delete("code");
    window.history.replaceState({}, "", nextUrl);

    await renderStudentHome(tabletId, {
      feedback: setIntent.isSubscribed
        ? "Schon hinzugefügt."
        : "Deck hinzugefügt.",
      highlightedSetPath: requestedSetPath,
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

async function loadLocalSetMetadata(setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);

  if (!normalizedSetPath) {
    return null;
  }

  if (!localSetMetadataCache.has(normalizedSetPath)) {
    localSetMetadataCache.set(normalizedSetPath, (async () => {
      try {
        const setUrl = new URL(normalizedSetPath, getAppBaseUrl());
        setUrl.searchParams.set("v", LOCAL_SET_METADATA_ASSET_VERSION);
        const data = await loadSet(setUrl.href);
        const setMeta = data?.set && typeof data.set === "object" ? data.set : null;
        const languages = setMeta?.languages && typeof setMeta.languages === "object" ? setMeta.languages : null;
        const subject = resolveLocalSetSubject(setMeta?.subject, languages);
        const languageLabels = resolveSetLanguageLabels(data);

        return {
          title: typeof setMeta?.title === "string" ? setMeta.title.trim() : "",
          subject,
          description: typeof setMeta?.description === "string" ? setMeta.description.trim() : "",
          cardCount: Array.isArray(data?.cards) ? data.cards.length : null,
          sourceLabel: languageLabels.sourceLabel,
          targetLabel: languageLabels.targetLabel,
          defaultDirection: normalizeLearningDirection(setMeta?.defaultDirections?.flashcard),
        };
      } catch (error) {
        console.error("Unable to load local set metadata:", error);
        return null;
      }
    })());
  }

  return localSetMetadataCache.get(normalizedSetPath);
}

function resolveLocalSetSubject(subject, languages) {
  const normalizedSubject = typeof subject === "string" ? subject.trim() : "";

  if (normalizedSubject) {
    return normalizedSubject;
  }

  const source = typeof languages?.source === "string" ? languages.source.trim().toLowerCase() : "";
  const target = typeof languages?.target === "string" ? languages.target.trim().toLowerCase() : "";

  if (source === "en" || target === "en") {
    return "English";
  }

  if (source === "de" || target === "de") {
    return "German";
  }

  return "";
}

async function resolveRequestedSetRequest() {
  const params = new URLSearchParams(window.location.search);
  const rawCode = normalizeSetShareCode(params.get("code"));
  const rawSet = params.get("set")?.trim();

  if (rawCode) {
    try {
      const response = await fetch(`/api/set-codes/${encodeURIComponent(rawCode)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      const resolvedPath = normalizeSetPath(data?.set?.path);
      if (!response.ok || !resolvedPath) {
        return {
          hasSetParam: true,
          isValid: false,
          path: "",
          url: "",
          detail: data?.error || "Set-Code nicht gefunden.",
        };
      }

      const canonicalUrl = new URL(window.location.href);
      canonicalUrl.searchParams.delete("code");
      canonicalUrl.searchParams.set("set", resolvedPath);
      window.history.replaceState({}, "", canonicalUrl);
      return {
        hasSetParam: true,
        isValid: true,
        path: resolvedPath,
        url: new URL(resolvedPath, getAppBaseUrl()).href,
        detail: "",
      };
    } catch (_error) {
      return {
        hasSetParam: true,
        isValid: false,
        path: "",
        url: "",
        detail: "Set-Code konnte nicht geprüft werden.",
      };
    }
  }

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

function normalizeSetShareCode(value) {
  const normalized = typeof value === "string"
    ? value.trim().toUpperCase().replace(/[\s-]+/g, "")
    : "";
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalized) ? normalized : "";
}

function getAppBaseUrl() {
  return new URL("./", window.location.href);
}

function setStudentAppMode(mode) {
  const previousMode = state.appMode;
  if (mode !== APP_MODES.INPUT) {
    clearInputAdvanceTimeout();
    closeInputSettingsMenu();
  }

  if (mode !== APP_MODES.FLASHCARD) {
    closeFlashcardSettingsMenu();
  }

  state.appMode = mode;
  if (mode !== APP_MODES.ACCESS) {
    delete elements.appShell.dataset.accessState;
  }
  if (mode !== APP_MODES.HOME) {
    closeLaunchModeModal();
  }
  elements.appShell.dataset.appMode = mode;
  elements.studentScreen.hidden = mode === APP_MODES.FLASHCARD || mode === APP_MODES.INPUT || mode === APP_MODES.TEST;
  elements.cardStage.hidden = mode !== APP_MODES.FLASHCARD;
  elements.inputStage.hidden = mode !== APP_MODES.INPUT;
  elements.testStage.hidden = mode !== APP_MODES.TEST;
  if (previousMode !== mode) {
    const activeSurface = mode === APP_MODES.FLASHCARD
      ? elements.cardStage
      : mode === APP_MODES.INPUT
        ? elements.inputStage
        : mode === APP_MODES.TEST
          ? elements.testStage
          : elements.studentScreen;
    window.LerndeckUiMotion.revealSurface(activeSurface);
  }
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
  renderStudentScreenTitle(title, mode);
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

function renderStudentScreenTitle(title, mode) {
  elements.studentScreenTitle.replaceChildren();

  const titleText = typeof title === "string" ? title : "";
  const showStackIcon = (mode === APP_MODES.HOME || mode === APP_MODES.ACCESS) && titleText === "Lerndeck";

  if (showStackIcon) {
    const icon = createStudentStackIcon("student-screen__title-icon");
    const titleMain = document.createElement("span");
    const titleLabel = document.createElement("span");
    titleMain.className = "student-screen__title-main";
    titleLabel.className = "student-screen__title-label";
    titleLabel.textContent = titleText;
    elements.studentScreenTitle.classList.add("student-screen__title--stacked");
    titleMain.append(icon, titleLabel);
    elements.studentScreenTitle.append(titleMain);
  } else {
    elements.studentScreenTitle.classList.remove("student-screen__title--stacked");
    elements.studentScreenTitle.append(document.createTextNode(titleText));
  }
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
  return state.appMode === APP_MODES.ACCESS
    || state.appMode === APP_MODES.SCANNER
    || state.appMode === APP_MODES.LOAD_ERROR;
}

function updateStudentShareBlock() {
  if (!elements.studentShareBlock) {
    return;
  }

  const isVisible = shouldShowStudentShareBlock();
  const inAccessMode = state.appMode === APP_MODES.ACCESS;
  const isModalOpen = inAccessMode && state.accessShareExpanded;
  const shouldRenderQr = isVisible && (!inAccessMode || isModalOpen);

  if (inAccessMode) {
    if (isModalOpen && !window.LerndeckUiMotion.isVisible(elements.studentShareBlock)) {
      window.LerndeckUiMotion.show(elements.studentShareBlock);
      document.body.classList.add("student-share-modal-open");
    } else if (!isModalOpen && !elements.studentShareBlock.hidden) {
      window.LerndeckUiMotion.hide(elements.studentShareBlock, {
        after: () => document.body.classList.remove("student-share-modal-open"),
      });
    }
  } else {
    elements.studentShareBlock.hidden = !isVisible;
    elements.studentShareBlock.setAttribute("aria-hidden", isVisible ? "false" : "true");
    document.body.classList.remove("student-share-modal-open");
  }

  if (!shouldRenderQr) {
    qrRenderSequence += 1;
    return;
  }

  const shareUrl = buildStudentShareUrlForCurrentLocation();
  elements.studentShareBlock.dataset.shareUrl = shareUrl;
  elements.studentShareCopy.setAttribute("data-share-url", shareUrl);
  setStudentShareCopyState(false);

  if (window.QRious && elements.studentShareQr) {
    scheduleQrRender(elements.studentShareQr, shareUrl, {
      foreground: "#1f1f1f",
    });
  }
}

function scheduleQrRender(canvas, value, options = {}) {
  const renderToken = ++qrRenderSequence;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (renderToken !== qrRenderSequence) {
        return;
      }

      if (!canvas || !canvas.isConnected || canvas.getClientRects().length === 0) {
        return;
      }

      renderQrIntoCanvas(canvas, value, options);
    });
  });
}

function renderQrIntoCanvas(canvas, value, {
  foreground = "#1f1f1f",
  background = "#f7f9fc",
  level = "M",
} = {}) {
  if (!canvas || !window.QRious) {
    return;
  }

  const availableSize = getQrAvailableSize(canvas);
  const qrPadding = resolveQrPadding(availableSize);
  const canvasSize = resolveQrCanvasSize(availableSize, value, {
    level,
    padding: qrPadding,
  });

  canvas.style.removeProperty("width");
  canvas.style.removeProperty("height");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  new window.QRious({
    element: canvas,
    value,
    size: canvasSize,
    level,
    padding: qrPadding,
    foreground,
    background,
  });

  recenterRenderedQrContent(canvas, { background });
}

function resolveQrCanvasSize(availableSize, value, {
  level = "M",
  padding = 12,
} = {}) {
  const safeAvailableSize = Math.max(64, Math.floor(availableSize));
  const moduleCount = inferQrModuleCount(value, { level });

  if (!moduleCount) {
    return safeAvailableSize;
  }

  const availableInnerSize = Math.max(1, safeAvailableSize - (padding * 2));
  const moduleSize = Math.max(1, Math.floor(availableInnerSize / moduleCount));
  return Math.max(moduleCount + (padding * 2), moduleCount * moduleSize + (padding * 2));
}

function resolveQrPadding(availableSize) {
  return Math.max(6, Math.floor(availableSize * 0.05));
}

function getQrAvailableSize(canvas) {
  const measuredFrameSize = measureQrContainerSize(canvas, [
    ".student-share__qr-frame",
  ]);

  if (measuredFrameSize > 0) {
    return measuredFrameSize;
  }

  const measuredShellSize = measureQrContainerSize(canvas, [
    ".student-share__qr-shell",
  ]);

  if (measuredShellSize > 0) {
    return measuredShellSize;
  }

  const initialCanvasSize = getInitialQrCanvasSize(canvas);
  const rect = canvas.getBoundingClientRect();
  const measuredCanvasSize = Math.min(rect.width || 0, rect.height || 0);

  if (measuredCanvasSize > 0) {
    return Math.max(initialCanvasSize, Math.round(measuredCanvasSize));
  }

  return initialCanvasSize;
}

function measureQrContainerSize(canvas, selectors) {
  for (const selector of selectors) {
    const container = canvas.closest(selector);

    if (!(container instanceof HTMLElement)) {
      continue;
    }

    const styles = window.getComputedStyle(container);
    const availableWidth = container.clientWidth
      - parseFloat(styles.paddingLeft || "0")
      - parseFloat(styles.paddingRight || "0");
    const availableHeight = container.clientHeight
      - parseFloat(styles.paddingTop || "0")
      - parseFloat(styles.paddingBottom || "0");
    const nextSize = Math.min(
      availableWidth || 0,
      availableHeight || availableWidth || 0,
    );

    if (nextSize > 0) {
      return Math.max(64, Math.floor(nextSize));
    }
  }

  return 0;
}

function getInitialQrCanvasSize(canvas) {
  const cachedSize = Number.parseFloat(canvas?.dataset?.initialQrSize || "");

  if (Number.isFinite(cachedSize) && cachedSize > 0) {
    return Math.max(64, Math.floor(cachedSize));
  }

  const attributeWidth = Number.parseFloat(canvas?.getAttribute("width") || "");
  const attributeHeight = Number.parseFloat(canvas?.getAttribute("height") || "");
  const initialSize = Math.max(
    64,
    Math.floor(
      Math.min(attributeWidth || 0, attributeHeight || attributeWidth || 0)
      || 220,
    ),
  );

  if (canvas?.dataset) {
    canvas.dataset.initialQrSize = `${initialSize}`;
  }

  return initialSize;
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
    padding: Math.max(10, Math.round(QR_PROBE_SIZE * 0.09)),
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
        if (x < minX) {
          minX = x;
        }

        if (y < minY) {
          minY = y;
        }

        if (x > maxX) {
          maxX = x;
        }

        if (y > maxY) {
          maxY = y;
        }
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
    const copied = await copyTextToClipboard(shareUrl);

    if (!copied) {
      throw new Error("Clipboard unavailable");
    }

    setStudentShareCopyState(true);
    if (studentShareCopyResetTimerId) {
      window.clearTimeout(studentShareCopyResetTimerId);
    }
    studentShareCopyResetTimerId = window.setTimeout(() => {
      setStudentShareCopyState(false);
    }, 1700);
  } catch (error) {
    setStudentShareCopyState(false);
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {}
  }

  const fallbackField = document.createElement("textarea");
  fallbackField.value = text;
  fallbackField.setAttribute("readonly", "");
  fallbackField.style.position = "fixed";
  fallbackField.style.top = "-1000px";
  fallbackField.style.opacity = "0";
  document.body.append(fallbackField);
  fallbackField.select();
  fallbackField.setSelectionRange(0, fallbackField.value.length);

  let copied = false;

  try {
    copied = Boolean(document.execCommand("copy"));
  } catch (_error) {
    copied = false;
  }

  fallbackField.remove();
  return copied;
}

function setStudentShareCopyState(isCopied) {
  setShareCopyButtonState(elements.studentShareCopy, {
    isCopied,
    defaultLabel: "Link kopieren",
    copiedLabel: "Link kopiert",
  });
}

function setShareCopyButtonState(button, {
  isCopied,
  defaultLabel,
  copiedLabel,
} = {}) {
  if (!(button instanceof HTMLElement)) {
    return;
  }

  const text = button.querySelector(".student-share__copy-text");
  const icon = button.querySelector(".student-share__copy-icon");
  const nextLabel = isCopied ? copiedLabel : defaultLabel;

  button.classList.toggle("is-copied", isCopied);
  button.setAttribute("aria-label", nextLabel);
  button.dataset.copied = isCopied ? "true" : "false";

  if (text) {
    text.textContent = nextLabel;
  }

  if (icon) {
    icon.classList.toggle("student-share__copy-icon--check", isCopied);
    icon.classList.toggle("student-share__copy-icon--copy", !isCopied);
  }
}

function openStudentShareModal() {
  state.accessShareExpanded = true;
  elements.studentShareUtility?.setAttribute("aria-expanded", "true");
  elements.studentShareUtility?.setAttribute("aria-label", "QR-Code ausblenden");
  const label = elements.studentShareUtility?.querySelector(".student-screen__access-utility-label");
  if (label) {
    label.textContent = "QR-Code ausblenden";
  }
  updateStudentShareBlock();
}

function closeStudentShareModal() {
  if (!state.accessShareExpanded) {
    return;
  }

  state.accessShareExpanded = false;
  elements.studentShareUtility?.setAttribute("aria-expanded", "false");
  elements.studentShareUtility?.setAttribute("aria-label", "QR-Code anzeigen");
  const label = elements.studentShareUtility?.querySelector(".student-screen__access-utility-label");
  if (label) {
    label.textContent = "QR-Code anzeigen";
  }
  updateStudentShareBlock();
  requestAnimationFrame(() => {
    elements.studentShareUtility?.focus();
  });
}

function handleStudentShareOverlayClick(event) {
  if (
    event.target !== elements.studentShareBlock
    && !event.target.closest?.("[data-close-share]")
  ) {
    return;
  }

  closeStudentShareModal();
}

function clearStudentScreenForm() {
  elements.studentScreenForm.replaceChildren();
  elements.studentScreenForm.hidden = true;
}

function createAccessUtilityIcon({ iconName = "", iconPath = "" } = {}) {
  const iconShell = document.createElement("span");
  iconShell.className = "student-screen__access-utility-icon";

  if (iconPath) {
    const iconImage = document.createElement("span");
    iconImage.className = "student-screen__access-utility-icon-image";
    iconImage.setAttribute("aria-hidden", "true");
    iconImage.style.maskImage = `url("${iconPath}")`;
    iconImage.style.webkitMaskImage = `url("${iconPath}")`;
    iconShell.append(iconImage);
    return iconShell;
  }

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconName;
  iconShell.append(icon);
  return iconShell;
}

function createStudentShareUtilityButton() {
  const utility = document.createElement("button");
  utility.type = "button";
  utility.className = "student-screen__access-utility";
  utility.setAttribute("aria-expanded", state.accessShareExpanded ? "true" : "false");
  utility.setAttribute("aria-label", state.accessShareExpanded ? "QR-Code ausblenden" : "QR-Code anzeigen");
  utility.setAttribute("aria-haspopup", "dialog");
  elements.studentShareUtility = utility;

  const label = document.createElement("span");
  label.className = "student-screen__access-utility-label";
  label.textContent = state.accessShareExpanded ? "QR-Code ausblenden" : "QR-Code anzeigen";

  utility.append(createAccessUtilityIcon({ iconName: "qr_code_2" }), label);
  utility.addEventListener("click", () => {
    if (state.accessShareExpanded) {
      closeStudentShareModal();
      return;
    }

    openStudentShareModal();
  });

  return utility;
}

function createAccessBackButton(onClick, label = "Zurück", {
  iconOnly = false,
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = iconOnly
    ? "student-screen__access-footer-back student-screen__access-footer-back--icon-only"
    : "student-screen__access-footer-back";
  button.setAttribute("aria-label", label || "Zurück");

  const icon = document.createElement("img");
  icon.className = "student-screen__access-footer-back-icon";
  icon.src = ACCESS_BACK_ICON_PATH;
  icon.alt = "";
  icon.decoding = "async";
  icon.setAttribute("aria-hidden", "true");

  if (iconOnly) {
    button.append(icon);
  } else {
    const text = document.createElement("span");
    text.className = "student-screen__access-footer-back-label";
    text.textContent = label;
    button.append(icon, text);
  }

  button.addEventListener("click", onClick);
  return button;
}

function createAccessFooter({ backButton = null } = {}) {
  if (!backButton) {
    return null;
  }

  const footer = document.createElement("div");
  footer.className = "student-screen__access-footer";
  footer.append(backButton);
  return footer;
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

  const icon = document.createElement("span");
  icon.className = "device-pill__icon";
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "device-pill__label";
  label.textContent = tablet.label || formatTabletLabel(tablet.id);

  pill.append(icon, label);
  return pill;
}

function createAccessChoiceCard({
  title,
  text,
  variant = "primary",
  iconPath = TABLET_ICON_PATH,
  onClick,
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    "student-screen__access-choice",
    variant === "secondary"
      ? "student-screen__access-choice--secondary"
      : "student-screen__access-choice--primary",
  ].join(" ");
  button.addEventListener("click", onClick);

  const icon = document.createElement("img");
  icon.className = "student-screen__access-choice-icon";
  if (iconPath === ACCESS_CONTINUE_ICON_PATH) {
    icon.classList.add("student-screen__access-choice-icon--continue");
  }
  if (iconPath === ACCESS_REGISTER_ICON_PATH) {
    icon.classList.add("student-screen__access-choice-icon--register");
  }
  icon.src = iconPath;
  icon.alt = "";
  icon.decoding = "async";
  icon.setAttribute("aria-hidden", "true");

  const titleElement = document.createElement("span");
  titleElement.className = "student-screen__access-choice-title";
  titleElement.textContent = title;

  const textElement = document.createElement("span");
  textElement.className = "student-screen__access-choice-text";
  textElement.textContent = text;

  const textBlock = document.createElement("span");
  textBlock.className = "student-screen__access-choice-text-block";
  textBlock.append(titleElement, textElement);

  button.append(icon, textBlock);
  return button;
}

function createAccessSectionHeaderIcon(iconPath) {
  const iconShell = document.createElement("span");
  iconShell.className = "student-screen__access-section-icon";

  const icon = document.createElement("img");
  icon.className = "student-screen__access-section-icon-image";
  icon.src = iconPath;
  icon.alt = "";
  icon.decoding = "async";

  iconShell.append(icon);
  return iconShell;
}

function configureStudentScreenAction(button, action, label) {
  const isVisible = Boolean(action && label);
  button.hidden = !isVisible;
  button.disabled = !isVisible;
  button.replaceChildren();

  if (!isVisible) {
    return;
  }

  if (action === "clear-local-tablet") {
    const icon = document.createElement("span");
    icon.className = "student-screen__action-icon";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
  }

  button.append(document.createTextNode(label));
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
  clearAccessCooldownTimer();
  const accessSession = normalizeAccessSession(state.accessSession);
  const hasBoundAccessSession = Boolean(accessSession?.isBound && accessSession.tabletId);
  const boundTabletId = hasBoundAccessSession ? accessSession.tabletId : "";
  const isCoolingDown = Boolean(hasBoundAccessSession && accessSession.isCoolingDown && getAccessSessionRemainingMs(accessSession) > 0);
  const localTabletId = loadLocalTabletId();
  const hasKnownDevice = Boolean(localTabletId);
  const explicitFlow = state.accessSelectedFlow;
  const shouldShowRegistration = !hasBoundAccessSession && (showRegistration || explicitFlow === "registration");
  const showContinueState = !hasBoundAccessSession
    && hasKnownDevice
    && !state.accessUseAlternate
    && explicitFlow !== "chooser"
    && explicitFlow !== "login"
    && !shouldShowRegistration;
  const showChooserState = !hasBoundAccessSession
    && !showContinueState
    && !shouldShowRegistration
    && (
      explicitFlow === "chooser"
      || (!hasKnownDevice && !state.accessUseAlternate)
      || (state.accessUseAlternate && explicitFlow !== "login" && !loginTabletId && !registrationTabletId)
    );
  const loginTablets = hasBoundAccessSession
    ? [getTabletMeta(boundTabletId)].filter(Boolean)
    : getLoginTablets();
  const registrationTablets = getRegistrationTablets();
  const openRegistrationFlow = () => {
    state.accessUseAlternate = true;
    state.accessSelectedFlow = "registration";
    renderAccessState({
      registrationTabletId: resolveTabletSelection("", {
        tablets: registrationTablets,
        preferFirstAvailable: registrationTablets.length === 1,
      }),
      showRegistration: true,
    });
  };

  state.accessRegistrationOpen = shouldShowRegistration;
  state.accessKnownDeviceFeedback = knownDeviceFeedback;
  state.accessSelectedFlow = hasBoundAccessSession
    ? "login"
    : (showContinueState
    ? "continue"
    : (showChooserState ? "chooser" : (shouldShowRegistration ? "registration" : "login")));

  renderStudentScreen({
    mode: APP_MODES.ACCESS,
    title: "Lerndeck",
    message: "",
    detail: "",
    kicker: "",
    secondaryAction: !localTabletId && state.requestedSetPath ? "clear-set" : "",
    secondaryLabel: !localTabletId && state.requestedSetPath ? "Start" : "",
  });
  elements.appShell.dataset.accessState = showContinueState
    ? "continue"
    : (showChooserState ? "chooser" : (shouldShowRegistration ? "registration" : "login"));

  const container = document.createElement("div");
  container.className = "student-screen__access";
  container.classList.add(showContinueState ? "student-screen__access--continue" : "student-screen__access--entry");

  const stage = document.createElement("div");
  stage.className = "student-screen__access-stage";
  const accessUtility = createStudentShareUtilityButton();
  accessUtility.classList.add("student-screen__access-utility--row");
  container.append(stage);

  if (showContinueState) {
    accessUtility.classList.add("student-screen__access-utility--row");
    let quickActions = null;

    const quickSection = document.createElement("section");
    quickSection.className = "student-screen__access-card student-screen__access-card--continue";

    const quickHeader = document.createElement("div");
    quickHeader.className = "student-screen__access-section-header";

    const quickTitle = document.createElement("h2");
    quickTitle.className = "student-screen__access-section-title";
    quickTitle.textContent = "Weiterlernen";

    const quickDeviceMeta = createDeviceContextRow(localTabletId, {
      prefix: "Zuletzt benutzt:",
    });
    quickDeviceMeta.classList.add("student-screen__access-device-meta");

    const quickDivider = document.createElement("span");
    quickDivider.className = "student-screen__access-quick-divider";
    quickDivider.setAttribute("aria-hidden", "true");
    quickDivider.append(
      document.createElement("span"),
      document.createElement("span"),
      document.createElement("span"),
    );

    const quickPinInput = createAccessPinInputField("pin-entry", "PIN eingeben", {
      disabled: isCoolingDown,
    });

    const quickPinShell = document.createElement("div");
    quickPinShell.className = "student-screen__access-quick-pin";
    quickPinShell.append(quickPinInput);

    const quickRow = document.createElement("div");
    quickRow.className = "student-screen__access-quick-row";
    quickRow.append(quickDeviceMeta, quickDivider, quickPinShell);

    quickHeader.append(quickTitle);

    const quickForm = document.createElement("form");
    quickForm.className = "student-screen__access-form";
    quickForm.noValidate = true;
    quickForm.dataset.accessVariant = "quick";
    quickForm.addEventListener("submit", handlePinSubmit);
    quickForm.append(
      createHiddenInput("tabletId", localTabletId),
      quickRow,
      createStudentSubmitButton("Starten"),
      createStudentFeedback(knownDeviceFeedback),
    );

    quickActions = document.createElement("div");
    quickActions.className = "student-screen__access-inline-actions student-screen__access-inline-actions--chooser";

    const quickActionsDivider = document.createElement("span");
    quickActionsDivider.className = "student-screen__access-row-divider";
    quickActionsDivider.setAttribute("aria-hidden", "true");

    const otherButton = document.createElement("button");
    otherButton.type = "button";
    otherButton.className = "student-screen__access-utility student-screen__access-utility--row";
    otherButton.setAttribute("aria-label", "Anderes Gerät");

    const otherLabel = document.createElement("span");
    otherLabel.className = "student-screen__access-utility-label";
    otherLabel.textContent = "Anderes Gerät";

    otherButton.append(
      createAccessUtilityIcon({ iconPath: ACCESS_OTHER_DEVICE_ICON_PATH }),
      otherLabel,
    );
    otherButton.addEventListener("click", () => {
      state.accessUseAlternate = true;
      state.accessSelectedFlow = "chooser";
      renderAccessState({
        showRegistration: false,
      });
    });

    quickSection.append(quickHeader, quickForm);
    stage.append(quickSection);
    elements.studentScreenForm.replaceChildren(container);
    elements.studentScreenForm.append(quickActions);
    quickActions.append(otherButton, quickActionsDivider, accessUtility);
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    return;
  }

  if (showChooserState) {
    accessUtility.classList.add("student-screen__access-utility--row");
    let chooserActions = null;

    const chooserSection = document.createElement("section");
    chooserSection.className = "student-screen__access-card student-screen__access-card--chooser";

    const chooserGrid = document.createElement("div");
    chooserGrid.className = "student-screen__access-choice-grid";
    chooserGrid.append(
      createAccessChoiceCard({
        variant: "primary",
        title: "Weiterlernen",
        text: "Mit PIN anmelden und beim Lernstand weitermachen.",
        iconPath: ACCESS_CONTINUE_ICON_PATH,
        onClick: () => {
          state.accessUseAlternate = true;
          state.accessSelectedFlow = "login";
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
        variant: "secondary",
        title: "Neu einrichten",
        text: "Nur für freie Tablets, die noch nicht eingerichtet sind.",
        iconPath: ACCESS_REGISTER_ICON_PATH,
        onClick: openRegistrationFlow,
      }),
    );

    chooserSection.append(chooserGrid);
    stage.append(chooserSection);

    if (hasKnownDevice) {
      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = "student-screen__inline-action student-screen__inline-action--chooser";
      backButton.append(createDeviceContextRow(localTabletId, {
        prefix: "Weiter mit",
      }));
      backButton.addEventListener("click", () => {
        state.accessUseAlternate = false;
        state.accessSelectedFlow = "";
        renderAccessState({
          loginTabletId: localTabletId,
          knownDeviceFeedback,
          showRegistration: false,
        });
      });

      const chooserActionsDivider = document.createElement("span");
      chooserActionsDivider.className = "student-screen__access-row-divider";
      chooserActionsDivider.setAttribute("aria-hidden", "true");

      chooserActions = document.createElement("div");
      chooserActions.className = "student-screen__access-inline-actions student-screen__access-inline-actions--chooser";
      chooserActions.append(backButton, chooserActionsDivider, accessUtility);
    }

    elements.studentScreenForm.replaceChildren(container);
    if (hasKnownDevice) {
      elements.studentScreenForm.append(chooserActions);
    } else {
      accessUtility.classList.add("student-screen__access-utility--centered");
      elements.studentScreenForm.append(accessUtility);
    }
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    return;
  }

  if (!shouldShowRegistration) {
    const loginSection = document.createElement("section");
    loginSection.className = "student-screen__access-card student-screen__access-card--login";

    const loginHeader = document.createElement("div");
    loginHeader.className = "student-screen__access-section-header";

    const loginTitle = document.createElement("h2");
    loginTitle.className = "student-screen__access-section-title";
    loginTitle.textContent = "Weiterlernen";

    const loginText = document.createElement("p");
    loginText.className = "student-screen__access-section-text";
    loginText.textContent = "Mit PIN anmelden";

    const resolvedLoginTabletId = resolveTabletSelection(hasBoundAccessSession ? boundTabletId : loginTabletId, {
      tablets: loginTablets,
      preferFirstAvailable: !hasBoundAccessSession && loginTablets.length === 1,
    });

    loginHeader.append(createAccessSectionHeaderIcon(ACCESS_CONTINUE_ICON_PATH), loginTitle);

    if (loginTablets.length > 0) {
      loginHeader.append(loginText);
    }

    const loginForm = document.createElement("form");
    loginForm.className = "student-screen__access-form student-screen__access-form--login";
    loginForm.noValidate = true;
    loginForm.dataset.accessVariant = "login";
    loginForm.addEventListener("submit", handlePinSubmit);

    if (loginTablets.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "student-screen__access-empty";

      const emptyText = document.createElement("p");
      emptyText.className = "student-screen__access-empty-text";
      emptyText.textContent = "Noch kein Tablet eingerichtet";

      const setupButton = createStudentSubmitButton("Tablet einrichten");
      setupButton.type = "button";
      setupButton.classList.add("student-screen__access-empty-action");
      setupButton.addEventListener("click", openRegistrationFlow);

      emptyState.append(emptyText, setupButton);
      loginForm.append(emptyState);
    } else {
      const loginTabletPicker = createTabletDropdownPicker("tabletId", resolvedLoginTabletId, {
        tablets: loginTablets,
        disabled: hasBoundAccessSession,
        locked: hasBoundAccessSession,
      });

      const loginPinInput = createAccessPinInputField("pin-entry", "PIN eingeben", {
        disabled: isCoolingDown,
      });

      const loginRow = document.createElement("div");
      loginRow.className = "student-screen__access-login-row";
      loginRow.append(
        createStudentFieldlessControl(loginTabletPicker),
        createStudentFieldlessControl(loginPinInput),
      );

      const loginFeedbackMessage = hasBoundAccessSession && isCoolingDown
        ? formatAccessCooldownFeedback(accessSession.remainingMs, { includeWrongPin: true })
        : (loginFeedback || (hasBoundAccessSession ? formatAccessBoundTabletMessage(boundTabletId) : ""));
      const loginFeedbackElement = createStudentFeedback(loginFeedbackMessage);

      if (hasBoundAccessSession && isCoolingDown) {
        loginFeedbackElement.dataset.accessCooldownFeedback = "true";
      }

      loginForm.append(
        loginRow,
        createAccessSubmitButton("Starten", accessSession),
        loginFeedbackElement,
      );
    }

    loginSection.append(loginHeader, loginForm);
    stage.append(loginSection);
    elements.studentScreenForm.replaceChildren(container);
    const loginActions = document.createElement("div");
    loginActions.className = "student-screen__access-inline-actions student-screen__access-inline-actions--chooser";
    loginActions.append(
      createAccessBackButton(async () => {
        if (hasBoundAccessSession) {
          await ensureAccessSessionLoaded();

          if (state.accessSession?.isBound) {
            renderAccessState({
              loginTabletId: state.accessSession.tabletId,
              loginFeedback: state.accessSession.isCoolingDown
                ? `Dieses Tablet bleibt aktiv. Neuer Versuch in ${formatAccessSessionRemaining(state.accessSession.remainingMs)}.`
                : formatAccessBoundTabletMessage(state.accessSession.tabletId),
              showRegistration: false,
            });
            return;
          }
        }

        state.accessUseAlternate = true;
        state.accessSelectedFlow = "chooser";
        renderAccessState({
          knownDeviceFeedback,
          showRegistration: false,
        });
      }, "Zurück"),
      (() => {
        const divider = document.createElement("span");
        divider.className = "student-screen__access-row-divider";
        divider.setAttribute("aria-hidden", "true");
        return divider;
      })(),
      accessUtility,
    );
    elements.studentScreenForm.append(loginActions);
    elements.studentScreenForm.hidden = false;
    updateStudentShareBlock();
    if (isCoolingDown) {
      startAccessCooldownTimer();
    }
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
  registrationText.textContent = "Nur für freie Tablets";

  registrationHeader.append(createAccessSectionHeaderIcon(ACCESS_REGISTER_ICON_PATH), registrationTitle, registrationText);
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
      control: createTabletDropdownPicker("tabletId", resolvedRegistrationTabletId, {
        tablets: registrationTablets,
        emptyStateText: "Alle Tablets sind bereits eingerichtet.",
      }),
    }),
    createStudentField({
      label: "PIN",
      control: createAccessPinInputField("registration-pin", "Neuen PIN eingeben"),
    }),
    createStudentField({
      label: "PIN bestätigen",
      control: createAccessPinInputField("registration-pin-confirm", "PIN wiederholen"),
    }),
    createStudentSubmitButton("Starten"),
    createStudentFeedback(registrationFeedback),
  );

  registrationSection.append(registrationForm);
  stage.append(registrationSection);
  elements.studentScreenForm.replaceChildren(container);
  const registrationActions = document.createElement("div");
  registrationActions.className = "student-screen__access-inline-actions student-screen__access-inline-actions--chooser";
  registrationActions.append(
    createAccessBackButton(() => {
      state.accessUseAlternate = true;
      state.accessSelectedFlow = "chooser";
      renderAccessState({
        knownDeviceFeedback,
        showRegistration: false,
      });
    }, "Zurück"),
    (() => {
      const divider = document.createElement("span");
      divider.className = "student-screen__access-row-divider";
      divider.setAttribute("aria-hidden", "true");
      return divider;
    })(),
    accessUtility,
  );
  elements.studentScreenForm.append(registrationActions);
  elements.studentScreenForm.hidden = false;
  updateStudentShareBlock();
}

function openAddSetModal(initialView = "choice") {
  state.addSetModalView = initialView;
  document.body.classList.add("add-set-modal-open");
  window.LerndeckUiMotion.show(elements.addSetModal);
  renderAddSetModalView();
}

function closeAddSetModal() {
  state.addSetModalView = "choice";
  delete elements.addSetModal.dataset.view;
  window.LerndeckUiMotion.hide(elements.addSetModal, {
    after: () => {
      elements.addSetBody.replaceChildren();
      document.body.classList.remove("add-set-modal-open");
    },
  });
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
  if (event.target.closest(".input-stage__settings")) {
    return;
  }

  closeInputSettingsMenu();
  closeFlashcardSettingsMenu();

  if (
    event.target.closest(".student-screen__library-menu")
  ) {
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
  title.textContent = "Lernset hinzufügen";

  const actions = document.createElement("div");
  actions.className = "add-set-modal__choices";
  actions.append(
    createAddSetChoiceButton("Code", createAddSetLinkIcon(), () => setAddSetModalView("link"), true),
    createAddSetChoiceButton("QR", createAddSetQrIcon(), () => setAddSetModalView("scanner")),
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
  title.textContent = "Code oder Link";

  const form = document.createElement("form");
  form.className = "add-set-modal__form";
  form.noValidate = true;
  form.addEventListener("submit", handleAddSetLinkSubmit);

  const input = document.createElement("input");
  input.name = "manual-set-target";
  input.type = "text";
  input.className = "add-set-modal__input";
  input.setAttribute("aria-label", "Set-Code oder Link");
  input.autocapitalize = "characters";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "z. B. A7K9P2";
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
  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "qr_code_scanner";
  return icon;
}

function createAddSetLinkIcon() {
  return createAddSetIcon([
    ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2" }],
    ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2" }],
    ["line", { x1: "8", y1: "12", x2: "16", y2: "12" }],
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
    ? (subscription.id || "Deck")
    : subscription.title;
  state.activeStudentSetShareCode = normalizeSetShareCode(subscription.shareCode);
  state.activeStudentSetShareUrl = buildStudentShareUrlForSetPath(subscription.setPath);
  renderStudentSetModalBody();
  elements.studentSetModal.dataset.mode = state.studentSetModalMode;
  window.LerndeckUiMotion.show(elements.studentSetModal);
}

function openStudentSetConfirmModal(subscription) {
  state.studentSetModalMode = "confirm-unsubscribe";
  state.activeStudentSetPath = subscription.setPath;
  state.activeStudentSetTitle = subscription.title === subscription.setPath
    ? (subscription.id || "Deck")
    : subscription.title;
  state.activeStudentSetShareCode = "";
  state.activeStudentSetShareUrl = "";
  renderStudentSetModalBody();
  elements.studentSetModal.dataset.mode = state.studentSetModalMode;
  window.LerndeckUiMotion.show(elements.studentSetModal);
}

function closeStudentSetModal() {
  state.studentSetModalMode = "";
  state.activeStudentSetPath = "";
  state.activeStudentSetTitle = "";
  state.activeStudentSetShareCode = "";
  state.activeStudentSetShareUrl = "";
  if (studentSetShareCopyResetTimerId) {
    window.clearTimeout(studentSetShareCopyResetTimerId);
    studentSetShareCopyResetTimerId = null;
  }
  elements.studentSetModal.removeAttribute("aria-labelledby");
  elements.studentSetModal.removeAttribute("aria-describedby");
  delete elements.studentSetModal.dataset.mode;
  window.LerndeckUiMotion.hide(elements.studentSetModal, {
    after: () => elements.studentSetModalBody.replaceChildren(),
  });
}

function renderStudentSetModalBody() {
  const body = document.createElement("div");
  body.className = "student-set-panel__body";

  if (state.studentSetModalMode === "share") {
    body.classList.add("student-set-panel__body--share");

    const kicker = document.createElement("p");
    kicker.className = "student-share__kicker";
    kicker.textContent = "Link teilen";

    const qrShell = document.createElement("div");
    qrShell.className = "student-share__qr-shell";

    const qrLabel = document.createElement("p");
    qrLabel.className = "student-share__qr-label";
    qrLabel.id = "student-set-modal-title";
    qrLabel.textContent = state.activeStudentSetTitle || "Lerndeck";

    const qrFrame = document.createElement("div");
    qrFrame.className = "student-share__qr-frame";

    const qrCanvas = document.createElement("canvas");
    qrCanvas.className = "student-share__qr";
    qrCanvas.width = 180;
    qrCanvas.height = 180;
    qrFrame.append(qrCanvas);

    const code = document.createElement("p");
    code.className = "student-share__set-code";
    code.hidden = !state.activeStudentSetShareCode;

    const codeLabel = document.createElement("span");
    codeLabel.className = "student-share__set-code-label";
    codeLabel.textContent = "Set-Code";

    const codeValue = document.createElement("strong");
    codeValue.className = "student-share__set-code-value";
    codeValue.textContent = state.activeStudentSetShareCode;
    code.append(codeLabel, codeValue);

    const linkRow = document.createElement("div");
    linkRow.className = "student-share__link-row";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.id = "student-set-modal-copy";
    copyButton.className = "student-share__copy";
    copyButton.innerHTML = `
      <span class="student-share__copy-text">Link kopieren</span>
      <span class="student-share__copy-icon student-share__copy-icon--copy" aria-hidden="true"></span>
    `;
    copyButton.dataset.shareUrl = state.activeStudentSetShareUrl;
    copyButton.addEventListener("click", handleStudentSetShareCopy);
    setShareCopyButtonState(copyButton, {
      isCopied: false,
      defaultLabel: "Link kopieren",
      copiedLabel: "Link kopiert",
    });

    linkRow.append(copyButton);
    qrShell.append(qrLabel, qrFrame, code, linkRow);
    body.append(kicker, qrShell);
    elements.studentSetModal.setAttribute("aria-labelledby", "student-set-modal-title");
    elements.studentSetModal.removeAttribute("aria-describedby");

    scheduleQrRender(qrCanvas, state.activeStudentSetShareUrl, {
      foreground: "#1f1f1f",
    });
  } else if (state.studentSetModalMode === "confirm-unsubscribe") {
    const title = document.createElement("h2");
    title.className = "student-set-panel__title";
    title.textContent = "Deck entfernen?";

    const message = document.createElement("p");
    message.className = "student-set-panel__message";
    message.textContent = "Dabei gehen Lernstände, Übungsdaten und spätere Highscores für dieses Deck verloren.";

    const hint = document.createElement("p");
    hint.className = "student-set-panel__hint";
    hint.textContent = "Wenn du das Deck später wieder hinzufügst, startet es mit einem neuen Speicherstand.";

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
    confirmButton.textContent = "Entfernen";
    confirmButton.addEventListener("click", () => {
      void confirmStudentSetUnsubscribe();
    });

    actions.append(cancelButton, confirmButton);
    body.append(title, message, hint, actions);
    elements.studentSetModal.removeAttribute("aria-labelledby");
    elements.studentSetModal.removeAttribute("aria-describedby");
  }

  elements.studentSetModalBody.replaceChildren(body);
}

async function handleStudentSetShareCopy() {
  const copyButton = document.getElementById("student-set-modal-copy");
  const shareUrl = copyButton?.dataset?.shareUrl?.trim() || state.activeStudentSetShareUrl;

  if (!shareUrl) {
    return;
  }

  try {
    const copied = await copyTextToClipboard(shareUrl);

    if (!copied) {
      throw new Error("Clipboard unavailable");
    }

    setShareCopyButtonState(copyButton, {
      isCopied: true,
      defaultLabel: "Link kopieren",
      copiedLabel: "Link kopiert",
    });
    if (studentSetShareCopyResetTimerId) {
      window.clearTimeout(studentSetShareCopyResetTimerId);
    }
    studentSetShareCopyResetTimerId = window.setTimeout(() => {
      setShareCopyButtonState(copyButton, {
        isCopied: false,
        defaultLabel: "Link kopieren",
        copiedLabel: "Link kopiert",
      });
    }, 1700);
  } catch (_error) {
    setShareCopyButtonState(copyButton, {
      isCopied: false,
      defaultLabel: "Link kopieren",
      copiedLabel: "Link kopiert",
    });
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
} = {}) {
  const result = await loadTabletSubscriptions(tabletId);

  if (result.status === 409) {
    clearActiveLearningSession();
    clearLocalTabletId();
    clearStudentSessionUnlock();
    clearTabletSession();
    clearActiveTabletContext();
    resetTabletDirectoryCache();
    await ensureTabletDirectoryLoaded();
    renderAccessState({
      loginTabletId: "",
      registrationTabletId: tabletId,
    registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Decks und ohne Lernstände.",
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
      secondaryLabel: "Abmelden",
    });
    return;
  }

  state.subscriptions = result.subscriptions;

  renderStudentScreen({
    mode: APP_MODES.HOME,
    title: "Lerndeck",
    message: "",
    detail: "",
    kicker: "",
    primaryAction: "",
    primaryLabel: "",
    secondaryAction: "",
    secondaryLabel: "",
  });
  attachStudentHomeHeaderActions(tabletId);

  const library = document.createElement("div");
  library.className = "student-screen__library";
  const nodes = [];

  if (feedback) {
    const feedbackElement = createStudentFeedback(feedback);
    if (!feedbackIsError) {
      feedbackElement.classList.add("is-success");
    }
    nodes.push(feedbackElement);
  }

  if (state.subscriptions.length > 0) {
    for (const subscription of state.subscriptions) {
      library.append(createStudentSetRow(subscription, {
        isHighlighted: subscription?.setPath === highlightedSetPath,
      }));
    }
  }

  library.append(createStudentAddSetCard());

  nodes.push(library);
  elements.studentScreenForm.replaceChildren(...nodes);
  elements.studentScreenForm.hidden = false;
  syncStudentLibrarySlots(library);
}

function syncStudentLibrarySlots(library) {
  if (!(library instanceof HTMLElement)) {
    return;
  }

  for (const slot of library.querySelectorAll(".student-screen__library-slot")) {
    slot.remove();
  }
}

function attachStudentHomeHeaderActions(tabletId) {
  const actions = elements.studentScreen?.querySelector(".student-screen__actions");

  if (!(actions instanceof HTMLElement)) {
    return;
  }

  actions.querySelector(".student-screen__home-actions")?.remove();

  const homeActions = document.createElement("div");
  homeActions.className = "student-screen__home-actions";

  homeActions.append(
    createStudentHomeHeaderContext(tabletId),
    createStudentHomeActionsDivider(),
    createStudentHomeLogoutButton(),
  );

  actions.append(homeActions);
}

function createStudentHomeHeaderContext(tabletId) {
  const context = document.createElement("span");
  context.className = "student-screen__home-context";
  context.setAttribute("aria-label", `Angemeldetes Gerät: ${getTabletMeta(tabletId).label}`);

  context.append(
    createDevicePill(getTabletMeta(tabletId), {
      className: "device-pill--home-meta",
    }),
  );

  return context;
}

function createStudentHomeActionsDivider() {
  const divider = document.createElement("span");
  divider.className = "student-screen__home-divider student-screen__home-divider--actions";
  divider.setAttribute("aria-hidden", "true");
  return divider;
}

function createStudentLogoutButton(extraClassName = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Abmelden");
  button.className = [
    "student-screen__action",
    "student-screen__action--secondary",
    "student-screen__home-logout",
    extraClassName,
  ].filter(Boolean).join(" ");

  const icon = document.createElement("span");
  icon.className = "student-screen__action-icon";
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = "Abmelden";

  button.append(icon, label);
  button.addEventListener("click", () => {
    executeStudentScreenAction("clear-local-tablet");
  });
  return button;
}

function createStudentHomeLogoutButton() {
  return createStudentLogoutButton();
}

function createInputMenuLogoutButton() {
  return createStudentLogoutButton("input-stage__menu-logout");
}

function handleInputMenuLogout() {
  executeStudentScreenAction("clear-local-tablet");
}

function handleFlashcardMenuLogout() {
  executeStudentScreenAction("clear-local-tablet");
}

function handleFlashcardSettingsToggle(event) {
  event.preventDefault();
  toggleFlashcardSettingsMenu();
}

function handleLearningDirectionSelect(event) {
  const button = event.currentTarget;
  const nextDirection = parseLearningDirection(button?.dataset?.learningDirection);
  const groupName = button?.closest("[data-learning-direction-group]")?.dataset?.learningDirectionGroup;

  if (!nextDirection) {
    return;
  }

  if (groupName === "launch") {
    state.pendingLaunchDirection = nextDirection;
    syncLearningDirectionGroup(
      "launch",
      state.pendingLaunchDirection,
      getSubscriptionDirectionMetadata(getPendingLaunchSubscription()),
    );
    return;
  }

  if (groupName === "input") {
    if (state.baseCards.length === 0 || nextDirection === state.activeLearningDirection) {
      closeInputSettingsMenu();
      return;
    }

    state.activeLearningDirection = nextDirection;
    persistPreferredLearningDirection(state.currentSetPath, nextDirection);
    persistActiveLearningSession(
      state.currentSetPath,
      state.activeLearningModeKey,
      APP_MODES.INPUT,
      nextDirection,
    );
    state.allCards = orientLearningCards(state.baseCards, nextDirection);
    closeInputSettingsMenu();
    resetInputLearningState(state.allCards);
    renderInputSession();
    elements.inputStatusMessage.textContent = `${getLearningDirectionLabel(nextDirection)}. Durchgang neu gestartet.`;
    return;
  }

  if (
    groupName !== "flashcard"
    || state.baseCards.length === 0
    || nextDirection === state.activeLearningDirection
  ) {
    closeFlashcardSettingsMenu();
    return;
  }

  state.activeLearningDirection = nextDirection;
  persistPreferredLearningDirection(state.currentSetPath, nextDirection);
  persistActiveLearningSession(
    state.currentSetPath,
    state.activeLearningModeKey,
    APP_MODES.FLASHCARD,
    nextDirection,
  );
  state.allCards = orientLearningCards(state.baseCards, nextDirection);
  closeFlashcardSettingsMenu();
  restartLearningSession();
  elements.statusMessage.textContent = `${getLearningDirectionLabel(nextDirection)}. Runde neu gestartet.`;
}

function handleInputSettingsToggle(event) {
  event.preventDefault();
  toggleInputSettingsMenu();
}

function handleInputCorrectionToggleChange(event) {
  const nextValue = Boolean(event.currentTarget?.checked);
  if (state.inputCorrectionModeEnabled === nextValue) {
    syncInputSettingsControls();
    return;
  }

  state.inputCorrectionModeEnabled = nextValue;
  applyInputSettingsToCurrentSession();
}

function handleInputDelayTypeSelect(event) {
  const nextType = event.currentTarget?.dataset?.delayType === "wrong" ? "wrong" : "correct";
  if (state.inputDelayEditorType === nextType) {
    syncInputSettingsControls();
    return;
  }

  state.inputDelayEditorType = nextType;
  syncInputSettingsControls();
}

function handleInputDelaySliderChange(event) {
  const delayEditorType = state.inputDelayEditorType === "wrong" ? "wrong" : "correct";
  const presets = getInputDelayPresets(delayEditorType);
  const nextPresetIndex = Math.min(
    Math.max(Math.round(Number(event.currentTarget?.value) || 0), 0),
    presets.length - 1,
  );
  const nextValue = presets[nextPresetIndex].delayMs;

  if (delayEditorType === "wrong") {
    if (state.inputIncorrectAdvanceDelayMs === nextValue) {
      syncInputSettingsControls();
      return;
    }

    state.inputIncorrectAdvanceDelayMs = nextValue;
    applyInputSettingsToCurrentSession();
    return;
  }

  if (state.inputCorrectAdvanceDelayMs === nextValue) {
    syncInputSettingsControls();
    return;
  }

  state.inputCorrectAdvanceDelayMs = nextValue;
  applyInputSettingsToCurrentSession();
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
    clearActiveLearningSession();
    state.requestedSetPath = "";
    state.requestedSetUrl = "";
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("set");
    nextUrl.searchParams.delete("code");
    window.history.replaceState({}, "", nextUrl);
    void continueStudentAccessFlow();
    return;
  }

  if (action === "clear-set") {
    clearActiveLearningSession();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("set");
    nextUrl.searchParams.delete("code");
    window.history.replaceState({}, "", nextUrl);
    initializeStudentApp();
    return;
  }

  if (action === "clear-local-tablet") {
    clearActiveLearningSession();
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
  closeInputSettingsMenu();
  clearActiveLearningSession();
  state.requestedSetPath = "";
  state.requestedSetUrl = "";
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  state.activeTestCardCount = TEST_DEFAULT_CARD_COUNT;
  resetInputLearningState();
  resetTestLearningState();
  elements.testTableBody.replaceChildren();

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("set");
  nextUrl.searchParams.delete("code");
  window.history.replaceState({}, "", nextUrl);

  await continueStudentAccessFlow();
}

function handleInputAnswerSubmit(event) {
  event.preventDefault();

  const card = getCurrentInputSessionCard();
  const correctionRequiredBeforeSubmit = isInputCorrectionRequired(state.inputSession);
  if (
    !card
    || state.inputSession.isComplete
    || (state.inputSession.evaluation && !correctionRequiredBeforeSubmit)
    || hasPendingInputAdvance()
  ) {
    return;
  }

  const rawValues = getInputAnswerValues(card);
  const evaluation = hasIrregularVerbAnswer(card)
    ? window.LerndeckIrregularVerbs.evaluateInputs(
        rawValues,
        card.irregularVerbAnswerGroups,
        evaluateInputAnswer,
      )
    : evaluateInputAnswer(rawValues[0], card.answers);
  const rawInput = rawValues.map((value) => value.trim() || "—").join(" · ");
  state.inputSession = applyInputEvaluationToSession(state.inputSession, evaluation, rawInput);
  if (isInputCorrectionRequired(state.inputSession) && evaluation.status !== "correct") {
    if (hasIrregularVerbAnswer(card)) {
      getInputVerbFields().forEach((input, index) => {
        if (evaluation.fieldEvaluations?.[index]?.status !== "correct") {
          input.value = "";
        }
      });
    } else {
      elements.inputAnswerField.value = "";
    }
  }
  renderInputSession();
  scheduleInputAdvance(evaluation);
}

function handleInputVerbFieldKeydown(event) {
  if (event.key !== "Enter" || event.repeat) {
    return;
  }

  const fields = getInputVerbFields();
  const currentIndex = fields.indexOf(event.currentTarget);
  const unansweredField = fields
    .slice(currentIndex + 1)
    .find((field) => !field.value.trim())
    || fields.slice(0, currentIndex).find((field) => !field.value.trim());

  if (!(unansweredField instanceof HTMLInputElement)) {
    return;
  }

  event.preventDefault();
  unansweredField.focus();
}

function handleInputRevealAnswer() {
  if (!isInputCorrectionRequired(state.inputSession)) {
    return;
  }

  state.inputSolutionRevealed = true;
  renderInputEvaluation(state.inputSession);
  focusFirstInputAnswerField(getCurrentInputSessionCard());
  elements.inputStatusMessage.textContent = `Korrekte Lösung: ${state.inputSession.evaluation?.bestAnswer || "unbekannt"}. Gib sie jetzt selbst ein.`;
}

async function handleInputAdvance() {
  clearInputAdvanceTimeout();

  if (state.inputSession.isComplete) {
    resetInputLearningState([...state.allCards]);
    renderInputSession();
    return;
  }

  if (!state.inputSession.evaluation) {
    return;
  }

  if (isInputCorrectionRequired(state.inputSession)) {
    return;
  }

  if (state.inputSession.currentIndex >= state.inputSession.cards.length - 1) {
    await finishInputSession();
    return;
  }

  state.inputSession = advanceInputSession(state.inputSession);
  state.inputSolutionRevealed = false;
  clearInputAnswerFields();
  renderInputSession();
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
      error: "Code oder Link eingeben.",
    };
  }

  const directShareCode = normalizeSetShareCode(trimmedValue);
  if (directShareCode) {
    return {
      isValid: true,
      setPath: "",
      url: buildCanonicalStudentCodeUrl(directShareCode),
      error: "",
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

  const parsedShareCode = normalizeSetShareCode(parsedUrl.searchParams.get("code"));
  if (parsedShareCode) {
    return {
      isValid: true,
      setPath: "",
      url: buildCanonicalStudentCodeUrl(parsedShareCode),
      error: "",
    };
  }

  const normalizedSetPath = normalizeSetPath(parsedUrl.searchParams.get("set"));

  if (!normalizedSetPath) {
    return {
      isValid: false,
      url: "",
      setPath: "",
      error: "Kein gültiger Code oder Link gefunden.",
    };
  }

  return {
    isValid: true,
    setPath: normalizedSetPath,
    url: buildCanonicalStudentSetUrl(normalizedSetPath),
    error: "",
  };
}

function buildCanonicalStudentCodeUrl(shareCode) {
  const url = new URL(window.location.pathname || "/index.html", window.location.origin);
  url.searchParams.set("code", shareCode);
  return url.href;
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

function createStudentFieldlessControl(control) {
  const wrapper = document.createElement("div");
  wrapper.className = "student-screen__field student-screen__field--bare";
  wrapper.append(control);
  return wrapper;
}

function createHiddenInput(name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

function createTabletDropdownPicker(name, selectedTabletId = "", {
  tablets = getAvailableTablets(),
  emptyStateText = "Keine Tablets verfügbar.",
  preferFirstAvailable = true,
  placeholder = "Tablet auswählen",
  disabled = false,
  locked = false,
} = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "student-screen__tablet-dropdown";

  if (tablets.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "student-screen__device-empty";
    emptyState.textContent = emptyStateText;
    wrapper.append(emptyState);
    return wrapper;
  }

  const resolvedSelection = resolveTabletSelection(selectedTabletId, {
    tablets,
    preferFirstAvailable,
  });
  const selectedTablet = tablets.find((tablet) => tablet.id === resolvedSelection) || tablets[0] || null;
  const tabletGroup = getTabletGroupName(selectedTablet?.label || selectedTablet?.id || selectedTabletId);

  const field = document.createElement("div");
  field.className = "student-screen__tablet-input-shell";
  field.dataset.tabletGroup = tabletGroup;
  field.classList.toggle("is-disabled", disabled);
  field.classList.toggle("is-locked", locked);

  const icon = document.createElement("span");
  icon.className = "student-screen__tablet-icon";
  icon.setAttribute("aria-hidden", "true");

  const select = document.createElement("select");
  select.name = disabled ? `${name}-display` : name;
  select.required = true;
  select.className = "student-screen__select student-screen__tablet-select";
  select.disabled = disabled;
  select.dataset.accessTabletSelect = "true";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  placeholderOption.hidden = true;
  select.append(placeholderOption);

  for (const tablet of tablets) {
    const option = document.createElement("option");
    option.value = tablet.id;
    option.textContent = getTabletLabel(tablet.id);
    select.append(option);
  }

  select.value = resolvedSelection || "";

  if (!select.value) {
    select.selectedIndex = 0;
    placeholderOption.selected = true;
  }

  select.addEventListener("change", () => {
    const tablet = tablets.find((entry) => entry.id === select.value) || null;
    field.dataset.tabletGroup = getTabletGroupName(tablet?.label || tablet?.id || "");
  });

  field.append(icon, select);

  if (disabled && select.value) {
    field.append(createHiddenInput(name, select.value));
  }

  wrapper.append(field);
  return wrapper;
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

    const icon = document.createElement("span");
    icon.className = "device-pill__icon";
    icon.setAttribute("aria-hidden", "true");

    selectedPillLabel = document.createElement("span");
    selectedPillLabel.className = "device-pill__label";
    selectedPillLabel.textContent = resolvedSelection ? getTabletLabel(resolvedSelection) : "";

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
      selectedPill.append(icon, selectedPillLabel, clearButton);
    } else {
      selectedPill.append(icon, selectedPillLabel);
    }

    selectedSummary.append(selectedPill);

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

function createAccessPinInputField(name, placeholder, {
  disabled = false,
} = {}) {
  const shell = document.createElement("div");
  shell.className = "student-screen__pin-input-shell";
  shell.classList.toggle("is-disabled", disabled);

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.classList.add("student-screen__pin-icon");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z",
  );
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  icon.append(path);

  const input = createPinInput(name, placeholder);
  input.classList.add("student-screen__pin-input");
  input.setAttribute("aria-label", placeholder);
  input.disabled = disabled;
  input.dataset.accessPinInput = "true";

  shell.append(icon, input);
  return shell;
}

function createStudentSubmitButton(label) {
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "student-screen__submit";

  const content = document.createElement("span");
  content.className = "student-screen__submit-content";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.classList.add("student-screen__submit-icon");

  const iconPaths = [
    "M12 6v6l4 2",
    "M20 12v5",
    "M20 21h.01",
    "M21.25 8.2A10 10 0 1 0 16 21.16",
  ];

  for (const definition of iconPaths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", definition);
    icon.append(path);
  }

  const labelElement = document.createElement("span");
  labelElement.className = "student-screen__submit-label";
  labelElement.textContent = label;

  content.append(icon, labelElement);
  button.append(content);
  return button;
}

function applyAccessSubmitState(button, accessSession) {
  const normalizedSession = normalizeAccessSession(accessSession);
  const labelElement = button.querySelector(".student-screen__submit-label");
  const isCoolingDown = normalizedSession.isCoolingDown && getAccessSessionRemainingMs(normalizedSession) > 0;
  const progress = isCoolingDown ? getAccessCooldownProgress(normalizedSession) : 0;

  button.classList.toggle("student-screen__submit--cooldown", isCoolingDown);
  button.disabled = isCoolingDown;
  button.dataset.accessSubmit = "true";
  button.style.setProperty("--submit-timeout-progress", `${progress * 100}%`);

  if (labelElement) {
    labelElement.textContent = isCoolingDown ? "Timeout" : (button.dataset.defaultLabel || "Starten");
  }
}

function createAccessSubmitButton(label, accessSession = null) {
  const button = createStudentSubmitButton(label);
  button.dataset.defaultLabel = label;
  applyAccessSubmitState(button, accessSession);
  return button;
}

function createStudentFeedback(message) {
  const feedback = document.createElement("p");
  feedback.className = "student-screen__feedback";
  feedback.textContent = message;
  feedback.hidden = !message;
  return feedback;
}

async function ensureAccessSessionLoaded() {
  try {
    const response = await apiRequest(ACCESS_SESSION_API_PATH);
    syncAccessSessionState(response?.data?.accessSession || null);
  } catch (error) {
    console.error("Unable to load access session:", error);
    syncAccessSessionState(null);
  }
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
    accessSession: normalizeAccessSession(entry?.accessSession),
  };
}

function normalizeAccessSession(entry) {
  const tabletId = typeof entry?.tabletId === "string" ? entry.tabletId.trim() : "";
  const failureCount = Number.isFinite(entry?.failureCount) ? Math.max(0, Math.trunc(entry.failureCount)) : 0;
  const remainingMs = Number.isFinite(entry?.remainingMs) ? Math.max(0, Math.ceil(entry.remainingMs)) : 0;
  const lockedUntil = typeof entry?.lockedUntil === "string" && entry.lockedUntil.trim()
    ? entry.lockedUntil.trim()
    : "";

  return {
    tabletId,
    failureCount,
    isBound: Boolean(entry?.isBound && tabletId),
    isCoolingDown: Boolean(entry?.isCoolingDown && remainingMs > 0),
    lockedUntil,
    remainingMs,
  };
}

function syncAccessSessionState(entry) {
  const nextSession = normalizeAccessSession(entry);
  state.accessSession = nextSession.isBound ? nextSession : null;
}

function formatAccessSessionRemaining(remainingMs) {
  const safeRemainingMs = Math.max(0, Math.ceil(remainingMs));

  if (safeRemainingMs >= 60 * 1000) {
    const minutes = Math.ceil(safeRemainingMs / (60 * 1000));
    return `${minutes} Minute${minutes === 1 ? "" : "n"}`;
  }

  const seconds = Math.max(1, Math.ceil(safeRemainingMs / 1000));
  return `${seconds} Sekunde${seconds === 1 ? "" : "n"}`;
}

function formatAccessCooldownFeedback(remainingMs, { includeWrongPin = false } = {}) {
  const prefix = includeWrongPin ? "PIN stimmt nicht." : "Bitte warte";
  return `${prefix} ${formatAccessSessionRemaining(remainingMs)} und versuche es dann erneut.`;
}

function formatAccessBoundTabletMessage(tabletId) {
  return `Bitte zuerst den PIN für ${getTabletLabel(tabletId)} eingeben. Wechsel erst nach erfolgreichem Login möglich.`;
}

function getAccessPinCooldownDuration(failureCount) {
  if (!Number.isFinite(failureCount) || failureCount <= 0) {
    return 0;
  }

  const stepIndex = Math.min(
    ACCESS_PIN_COOLDOWN_STEPS_MS.length - 1,
    Math.max(0, Math.trunc(failureCount) - 1),
  );

  return ACCESS_PIN_COOLDOWN_STEPS_MS[stepIndex];
}

function getAccessSessionRemainingMs(session, now = Date.now()) {
  if (!session?.isBound) {
    return 0;
  }

  const lockedUntilMs = typeof session.lockedUntil === "string" && session.lockedUntil
    ? Date.parse(session.lockedUntil)
    : NaN;

  if (Number.isFinite(lockedUntilMs)) {
    return Math.max(0, Math.ceil(lockedUntilMs - now));
  }

  return Number.isFinite(session.remainingMs) ? Math.max(0, Math.ceil(session.remainingMs)) : 0;
}

function getAccessCooldownProgress(session, now = Date.now()) {
  const duration = getAccessPinCooldownDuration(session?.failureCount);
  const remainingMs = getAccessSessionRemainingMs(session, now);

  if (duration <= 0 || remainingMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, remainingMs / duration));
}

function clearAccessCooldownTimer() {
  if (!state.accessCooldownTimerId) {
    return;
  }

  window.clearInterval(state.accessCooldownTimerId);
  state.accessCooldownTimerId = null;
}

function updateAccessSessionClock(now = Date.now()) {
  const session = normalizeAccessSession(state.accessSession);

  if (!session.isBound) {
    state.accessSession = null;
    return session;
  }

  const remainingMs = getAccessSessionRemainingMs(session, now);
  const nextSession = {
    ...session,
    remainingMs,
    isCoolingDown: remainingMs > 0,
  };

  if (!nextSession.isCoolingDown) {
    nextSession.lockedUntil = "";
  }

  state.accessSession = nextSession;
  return nextSession;
}

function updateRenderedAccessCooldown(session = updateAccessSessionClock()) {
  const submitButton = elements.studentScreenForm.querySelector("[data-access-submit]");
  const cooldownFeedback = elements.studentScreenForm.querySelector("[data-access-cooldown-feedback]");

  if (submitButton) {
    applyAccessSubmitState(submitButton, session);
  }

  if (cooldownFeedback) {
    cooldownFeedback.textContent = session.isCoolingDown
      ? formatAccessCooldownFeedback(session.remainingMs, { includeWrongPin: true })
      : "";
    cooldownFeedback.hidden = !session.isCoolingDown;
  }
}

function startAccessCooldownTimer() {
  clearAccessCooldownTimer();

  const session = updateAccessSessionClock();

  if (!session.isBound || !session.isCoolingDown) {
    return;
  }

  updateRenderedAccessCooldown(session);

  state.accessCooldownTimerId = window.setInterval(() => {
    const nextSession = updateAccessSessionClock();

    if (!nextSession.isBound || !nextSession.isCoolingDown) {
      clearAccessCooldownTimer();
      renderAccessState({
        loginTabletId: nextSession.tabletId || loadLocalTabletId() || "",
        loginFeedback: nextSession.isBound
          ? formatAccessBoundTabletMessage(nextSession.tabletId || loadLocalTabletId() || "")
          : "",
        knownDeviceFeedback: state.accessKnownDeviceFeedback,
        showRegistration: false,
      });
      return;
    }

    updateRenderedAccessCooldown(nextSession);
  }, 100);
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
} = {}) {
  const row = document.createElement("article");
  row.className = "student-screen__library-card";
  row.classList.toggle("is-highlighted", isHighlighted);
  applyStudentSetCardColor(row, getResolvedStudentSetColorKey(subscription));

  const cover = document.createElement("div");
  cover.className = "student-screen__library-cover";

  const coverTools = document.createElement("div");
  coverTools.className = "student-screen__library-cover-tools";
  coverTools.append(createStudentSetMenu(subscription, row));

  const coverTitle = document.createElement("h3");
  coverTitle.className = "student-screen__library-cover-title";
  coverTitle.textContent = subscription.title === subscription.setPath
    ? (subscription.id || "Set")
    : subscription.title;

  cover.append(coverTools, coverTitle);

  const copy = document.createElement("div");
  copy.className = "student-screen__library-copy";

  const meta = document.createElement("p");
  meta.className = "student-screen__library-meta";
  meta.textContent = Number.isFinite(subscription.cardCount) ? `${subscription.cardCount} Karten` : "";

  const description = document.createElement("p");
  description.className = "student-screen__library-description";
  description.textContent = subscription.description || "Ohne Beschreibung";

  const stats = createStudentSetStats(subscription);

  copy.append(description, meta);
  if (stats) {
    copy.append(stats);
  }
  row.append(cover, copy);

  bindStudentLibraryPress(row, (event) => {
    if (event.target instanceof Element && event.target.closest(".student-screen__library-menu")) {
      return;
    }

    void handleStartSubscribedSet(subscription.setPath);
  });

  return row;
}

function createStudentSetMenu(subscription, row) {
  const menu = document.createElement("details");
  menu.className = "student-screen__library-menu";

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

  const {
    action: colorAction,
    panel: colorPanel,
    syncPreview,
  } = createStudentSetColorSection(subscription, row, menu);

  const shareButton = createStudentSetMenuAction({
    icon: createStudentSetMenuMaskIcon(EXTERNAL_LINK_ICON_PATH),
    label: "Teilen",
    onClick: () => {
      menu.open = false;
      openStudentSetShareModal(subscription);
    },
  });

  const divider = document.createElement("span");
  divider.className = "student-screen__library-menu-divider";
  divider.setAttribute("aria-hidden", "true");

  const unsubscribeButton = createStudentSetMenuAction({
    icon: createStudentSetMenuMaskIcon(LIBRARY_MINUS_ICON_PATH),
    label: "Entfernen",
    danger: true,
    onClick: () => {
      menu.open = false;
      openStudentSetConfirmModal(subscription);
    },
  });

  menu.addEventListener("toggle", () => {
    if (menu.open) {
      closeStudentSetMenus(menu);
      syncPreview();
      setStudentSetColorSectionExpanded(menu, colorAction, colorPanel, false);
      return;
    }

    setStudentSetColorSectionExpanded(menu, colorAction, colorPanel, false);
  });

  menuPanel.append(shareButton, colorAction, colorPanel, divider, unsubscribeButton);
  menu.append(summary, menuPanel);
  return menu;
}

function createStudentSetMenuAction({
  icon,
  label,
  trailing = null,
  danger = false,
  onClick = null,
} = {}) {
  const button = document.createElement("div");
  button.className = "student-screen__library-menu-action";
  button.classList.toggle("student-screen__library-menu-action--danger", danger);

  const copy = document.createElement("span");
  copy.className = "student-screen__library-menu-action-copy";
  copy.append(icon, document.createTextNode(label));
  button.append(copy);

  if (trailing) {
    button.append(trailing);
  }

  if (typeof onClick === "function") {
    bindStudentLibraryPress(button, onClick);
  }

  return button;
}

function createStudentSetStats(subscription) {
  const practiceProgress = getSubscriptionLearningModeProgress(subscription, DEFAULT_LEARNING_MODE_KEY);
  const roundCount = practiceProgress.completedRoundCount;

  if (roundCount > 0) {
    const items = getStudentSetStatItems(subscription);
    const band = document.createElement("section");
    band.className = "student-screen__library-stat-band";
    band.setAttribute("aria-label", "Persönliche Statistik");
    band.dataset.libraryPressStop = "true";

    const prevButton = createStudentSetStatBandButton("previous");
    const nextButton = createStudentSetStatBandButton("next");

    const viewport = document.createElement("div");
    viewport.className = "student-screen__library-stat-band-viewport";

    const track = document.createElement("div");
    track.className = "student-screen__library-stat-band-track";

    const slides = items.map((item) => createStudentSetStatSlide(item));
    track.append(...slides);
    viewport.append(track);
    band.append(prevButton, viewport, nextButton);

    if (slides.length > 1) {
      initializeStudentSetStatBand({
        band,
        viewport,
        track,
        slides,
        prevButton,
        nextButton,
      });
    } else {
      prevButton.disabled = true;
      nextButton.disabled = true;
      prevButton.hidden = true;
      nextButton.hidden = true;
    }

    return band;
  }

  return null;
}

function getStudentSetStatItems(subscription) {
  const practiceProgress = getSubscriptionLearningModeProgress(subscription, DEFAULT_LEARNING_MODE_KEY);
  return [
    {
      key: "rounds",
      label: "Durchgänge",
      value: String(practiceProgress.completedRoundCount),
      detail: "bisher abgeschlossen",
    },
    {
      key: "average-score",
      label: "Ø Score",
      value: formatStudentSetLastRoundPercent(practiceProgress.averageScorePercent),
      detail: "durchschnittlich erreicht",
    },
    {
      key: "last-round",
      label: "Letzter Durchgang",
      value: formatStudentSetLastRoundPercent(practiceProgress.lastRoundPercent),
      detail: "zuletzt erreicht",
    },
  ];
}

function createStudentSetStatSlide(item) {
  const slide = document.createElement("article");
  slide.className = "student-screen__library-stat-slide";
  slide.dataset.statKey = item.key;

  const label = document.createElement("span");
  label.className = "student-screen__library-stat-slide-label";
  label.textContent = item.label;

  const value = document.createElement("strong");
  value.className = "student-screen__library-stat-slide-value";
  value.textContent = item.value;

  const detail = document.createElement("span");
  detail.className = "student-screen__library-stat-slide-detail";
  detail.textContent = item.detail;

  slide.append(label, value, detail);
  return slide;
}

function createStudentSetStatBandButton(direction) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `student-screen__library-stat-band-button student-screen__library-stat-band-button--${direction}`;
  button.setAttribute("aria-label", direction === "previous" ? "Vorherige Statistik" : "Nächste Statistik");

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = direction === "previous" ? "chevron_left" : "chevron_right";
  button.append(icon);
  return button;
}

function initializeStudentSetStatBand({
  band,
  viewport,
  track,
  slides,
  prevButton,
  nextButton,
}) {
  let activeIndex = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerActive = false;

  const updateBand = () => {
    band.style.setProperty("--student-library-stat-index", `${activeIndex}`);

    slides.forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(index !== activeIndex));
    });
  };

  const goToSlide = (nextIndex) => {
    activeIndex = (nextIndex + slides.length) % slides.length;
    updateBand();
  };

  prevButton.addEventListener("click", () => {
    goToSlide(activeIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    goToSlide(activeIndex + 1);
  });

  viewport.addEventListener("pointerdown", (event) => {
    if ((event.pointerType || "mouse") === "mouse" && event.button !== 0) {
      return;
    }

    pointerActive = true;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;

    if (viewport.setPointerCapture) {
      viewport.setPointerCapture(event.pointerId);
    }
  });

  viewport.addEventListener("pointerup", (event) => {
    if (!pointerActive) {
      return;
    }

    pointerActive = false;

    if (viewport.releasePointerCapture) {
      viewport.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;

    if (Math.abs(deltaX) < 28 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    goToSlide(activeIndex + (deltaX < 0 ? 1 : -1));
  });

  viewport.addEventListener("pointercancel", () => {
    pointerActive = false;
  });

  updateBand();
}

function formatStudentSetLastRoundPercent(value) {
  return Number.isFinite(value) ? `${value} %` : "–";
}

function createStudentSetMenuMaskIcon(iconPath) {
  const icon = document.createElement("span");
  icon.className = "student-screen__library-menu-action-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.style.maskImage = `url("${iconPath}")`;
  icon.style.webkitMaskImage = `url("${iconPath}")`;
  return icon;
}

function createStudentSetMenuMaterialIcon(name, extraClassName = "") {
  const icon = document.createElement("span");
  icon.className = `material-symbols-outlined student-screen__library-menu-action-icon student-screen__library-menu-action-icon--material${extraClassName ? ` ${extraClassName}` : ""}`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = name;
  return icon;
}

function createStudentStackIcon(className = "") {
  const icon = document.createElement("img");
  icon.src = "./assets/icons/lerndeck-stack.svg";
  icon.alt = "";
  icon.decoding = "async";
  icon.setAttribute("aria-hidden", "true");
  if (className) {
    icon.classList.add(className);
  }
  return icon;
}

function createStudentSetColorSection(subscription, row, menu) {
  const previewDot = document.createElement("span");
  previewDot.className = "student-screen__library-menu-color-preview";
  previewDot.setAttribute("aria-hidden", "true");

  const chevron = createStudentSetMenuMaterialIcon("chevron_right", "student-screen__library-menu-chevron");
  const trailing = document.createElement("span");
  trailing.className = "student-screen__library-menu-action-trailing";
  trailing.append(previewDot, chevron);

  const action = createStudentSetMenuAction({
    icon: createStudentSetMenuMaterialIcon("palette"),
    label: "Deckfarbe",
    trailing,
    onClick: (event) => {
      event.preventDefault();
      const shouldExpand = menu.dataset.colorExpanded !== "true";
      setStudentSetColorSectionExpanded(menu, action, section, shouldExpand);
    },
  });

  action.classList.add("student-screen__library-menu-action--toggle");
  action.setAttribute("aria-expanded", "false");

  const section = document.createElement("section");
  section.className = "student-screen__library-color-section";
  section.hidden = true;

  const panel = document.createElement("div");
  panel.className = "student-screen__library-color-panel";
  const currentColorKey = getResolvedStudentSetColorKey(subscription);

  for (const color of STUDENT_SET_COLOR_PALETTE) {
    const swatch = document.createElement("span");
    swatch.className = "student-screen__library-color-swatch";
    swatch.dataset.colorKey = color.key;
    swatch.setAttribute("aria-label", `${color.label} wählen`);
    swatch.classList.toggle("is-selected", color.key === currentColorKey);
    swatch.style.setProperty("--student-library-swatch-start", color.headerStart);
    swatch.style.setProperty("--student-library-swatch-end", color.headerEnd);
    bindStudentLibraryPress(swatch, async (event) => {
      event.preventDefault();
      const previousColorKey = getResolvedStudentSetColorKey(subscription);

      if (previousColorKey === color.key && subscription?.cardColor === color.key) {
        menu.open = false;
        return;
      }

      subscription.cardColor = color.key;
      applyStudentSetCardColor(row, color.key);
      updateStudentSetColorSwatches(panel, color.key);
      syncPreview();
      menu.open = false;

      const tabletId = loadLocalTabletId();
      const result = await saveTabletSubscriptionCardColor(tabletId, subscription.setPath, color.key);

      if (result.ok) {
        subscription.cardColor = result.cardColor || color.key;
        saveLocalTabletSetColorPreference(tabletId, subscription.setPath, subscription.cardColor);
        applyStudentSetCardColor(row, subscription.cardColor);
        updateStudentSetColorSwatches(panel, subscription.cardColor);
        syncPreview();
        return;
      }

      if (!result.authRequired) {
        subscription.cardColor = color.key;
        saveLocalTabletSetColorPreference(tabletId, subscription.setPath, color.key);
        applyStudentSetCardColor(row, color.key);
        updateStudentSetColorSwatches(panel, color.key);
        syncPreview();
        return;
      }

      subscription.cardColor = previousColorKey;
      applyStudentSetCardColor(row, previousColorKey);
      updateStudentSetColorSwatches(panel, previousColorKey);
      syncPreview();
    });
    panel.append(swatch);
  }

  const syncPreview = () => {
    const colorEntry = getStudentSetColorPaletteEntry(getResolvedStudentSetColorKey(subscription));
    previewDot.style.setProperty("--student-library-color-preview-start", colorEntry.headerStart);
    previewDot.style.setProperty("--student-library-color-preview-end", colorEntry.headerEnd);
  };

  syncPreview();
  section.append(panel);
  return {
    action,
    panel: section,
    syncPreview,
  };
}

function updateStudentSetColorSwatches(panel, colorKey) {
  for (const swatch of panel.querySelectorAll(".student-screen__library-color-swatch")) {
    swatch.classList.toggle("is-selected", swatch.dataset.colorKey === colorKey);
  }
}

function bindStudentLibraryPress(element, onPress) {
  if (!(element instanceof HTMLElement) || typeof onPress !== "function") {
    return;
  }

  const getNestedInteractiveTarget = (target) => {
    if (!(target instanceof Element)) {
      return null;
    }

    const interactiveTarget = target.closest(
      "button, a, input, select, textarea, summary, details, [role=\"button\"], [data-library-press-stop]",
    );

    if (!interactiveTarget || interactiveTarget === element || !element.contains(interactiveTarget)) {
      return null;
    }

    return interactiveTarget;
  };

  const clearPressedState = () => {
    element.classList.remove("is-pressed");
  };

  element.setAttribute("role", "button");

  if (!element.hasAttribute("tabindex")) {
    element.tabIndex = 0;
  }

  element.addEventListener("pointerdown", (event) => {
    if ((event.pointerType || "mouse") === "mouse" && event.button !== 0) {
      return;
    }

    if (getNestedInteractiveTarget(event.target)) {
      return;
    }

    element.classList.add("is-pressed");
  });
  element.addEventListener("pointerup", clearPressedState);
  element.addEventListener("pointercancel", clearPressedState);
  element.addEventListener("pointerleave", clearPressedState);
  element.addEventListener("lostpointercapture", clearPressedState);
  element.addEventListener("click", (event) => {
    clearPressedState();
    if (getNestedInteractiveTarget(event.target)) {
      return;
    }

    onPress(event);
  });
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (getNestedInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    onPress(event);
  });
}

function setStudentSetColorSectionExpanded(menu, action, panel, expanded) {
  menu.dataset.colorExpanded = expanded ? "true" : "false";
  action.setAttribute("aria-expanded", expanded ? "true" : "false");
  action.classList.toggle("is-expanded", expanded);
  panel.hidden = !expanded;
}

function createStudentAddSetCard() {
  const card = document.createElement("article");
  card.className = "student-screen__library-card student-screen__library-card--add";
  card.setAttribute("aria-label", "Lernset hinzufügen");
  bindStudentLibraryPress(card, () => {
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

  const copy = document.createElement("span");
  copy.className = "student-screen__library-add-copy";

  const title = document.createElement("span");
  title.className = "student-screen__library-add-title";
  title.textContent = "Lernset hinzufügen";

  const text = document.createElement("span");
  text.className = "student-screen__library-add-text";
  text.textContent = "Mit Code oder QR";

  copy.append(title, text);
  card.append(iconWrap, copy);
  return card;
}

function applyStudentSetCardColor(card, colorKey) {
  const paletteEntry = getStudentSetColorPaletteEntry(colorKey);
  card.dataset.colorKey = paletteEntry.key;
  card.style.setProperty("--student-library-cover-start", paletteEntry.headerStart);
  card.style.setProperty("--student-library-cover-end", paletteEntry.headerEnd);
  card.style.setProperty("--student-library-cover-glow", paletteEntry.glow);
  card.style.setProperty("--student-library-badge-background", paletteEntry.badge);
}

function getResolvedStudentSetColorKey(subscription) {
  const explicitColor = typeof subscription?.cardColor === "string" ? subscription.cardColor.trim().toLowerCase() : "";
  const explicitEntry = STUDENT_SET_COLOR_PALETTE.find((entry) => entry.key === explicitColor);

  if (explicitEntry) {
    return explicitEntry.key;
  }

  const stableKeySource = typeof subscription?.id === "string" && subscription.id.trim()
    ? subscription.id.trim()
    : (subscription?.setPath || "default");
  return getDefaultStudentSetColorKey(stableKeySource);
}

function getDefaultStudentSetColorKey(value) {
  return STUDENT_SET_COLOR_PALETTE[getStableVariantIndex(value, STUDENT_SET_COLOR_PALETTE.length)].key;
}

function getStableVariantIndex(value, length) {
  let hash = 0;

  for (const char of String(value)) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }

  if (!Number.isFinite(length) || length <= 0) {
    return 0;
  }

  return hash % length;
}

function getStudentSetColorPaletteEntry(colorKey) {
  return STUDENT_SET_COLOR_PALETTE.find((entry) => entry.key === colorKey) || STUDENT_SET_COLOR_PALETTE[0];
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

function getPendingLaunchSubscription() {
  return state.subscriptions.find((entry) => entry?.setPath === state.pendingLaunchSetPath) || null;
}

function getSubscriptionCardCount(subscription) {
  return Number.isFinite(subscription?.cardCount)
    ? Math.max(1, Math.floor(subscription.cardCount))
    : TEST_DEFAULT_CARD_COUNT;
}

function getTestCardCountRange(subscription) {
  const maximum = getSubscriptionCardCount(subscription);
  return {
    minimum: Math.min(TEST_MIN_CARD_COUNT, maximum),
    maximum,
  };
}

function clampTestCardCount(value, subscription) {
  const { minimum, maximum } = getTestCardCountRange(subscription);
  const numericValue = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : TEST_DEFAULT_CARD_COUNT;
  return clamp(numericValue, minimum, maximum);
}

function formatLearningModePercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)} %` : "–";
}

function setLearningModeAccentVariables(target, mode) {
  if (!target || !mode) {
    return;
  }

  target.style.setProperty("--mode-accent", mode.accentColor);
  target.style.setProperty("--mode-accent-rgb", mode.accentRgb);
}

function getLaunchModeStatusLabel(mode, progress) {
  if (!mode.isAvailable) {
    return "Noch nicht freigeschaltet";
  }

  if (progress.completedRoundCount < 1) {
    return "Noch nie gelernt";
  }

  return progress.completedRoundCount === 1
    ? "1 Durchgang gespeichert"
    : `${progress.completedRoundCount} Durchgänge gespeichert`;
}

function createLaunchModeIcon(iconPath, extraClassName = "") {
  const icon = document.createElement("span");
  icon.className = `launch-mode-modal__mode-icon${extraClassName ? ` ${extraClassName}` : ""}`;
  icon.setAttribute("aria-hidden", "true");
  icon.style.maskImage = `url("${iconPath}")`;
  icon.style.webkitMaskImage = `url("${iconPath}")`;
  return icon;
}

function createLaunchModeDistributionSegment(mode, isSelected) {
  const segment = document.createElement("span");
  segment.className = "launch-mode-modal__distribution-segment";
  segment.classList.toggle("is-selected", isSelected);
  segment.dataset.modeKey = mode.key;
  segment.style.width = `${mode.distributionPercent}%`;
  setLearningModeAccentVariables(segment, mode);
  return segment;
}

function createLaunchModeDistributionLegendItem(mode, isSelected) {
  const item = document.createElement("span");
  item.className = "launch-mode-modal__distribution-item";
  item.classList.toggle("is-selected", isSelected);
  item.dataset.modeKey = mode.key;
  item.style.width = `${mode.distributionPercent}%`;
  setLearningModeAccentVariables(item, mode);

  const icon = createLaunchModeIcon(mode.iconPath, "launch-mode-modal__mode-icon--distribution");
  const value = document.createElement("span");
  value.className = "launch-mode-modal__distribution-value";
  value.textContent = `${mode.distributionPercent}%`;

  item.append(icon, value);
  return item;
}

function createLaunchModeSummaryLine(value, label) {
  const line = document.createElement("span");
  line.className = "launch-mode-modal__summary-line";

  const amount = document.createElement("span");
  amount.className = "launch-mode-modal__summary-value";
  amount.textContent = value;

  const text = document.createElement("span");
  text.className = "launch-mode-modal__summary-label";
  text.textContent = label;

  line.append(amount, text);
  return line;
}

function createLaunchModeSummary(progress) {
  const summary = document.createElement("span");
  summary.className = "launch-mode-modal__mode-summary";
  const runsValue = String(progress.completedRoundCount);
  const runsLabel = progress.completedRoundCount === 1 ? "Durchgang" : "Durchgänge";
  summary.append(createLaunchModeSummaryLine(runsValue, runsLabel));
  return summary;
}

function getLaunchModeDistributionMetrics(modeKey) {
  let start = 0;

  for (const mode of LEARNING_MODES) {
    const width = mode.distributionPercent;

    if (mode.key === modeKey) {
      return {
        mode,
        start,
        width,
      };
    }

    start += width;
  }

  const fallbackMode = getLearningModeDefinition(modeKey);
  return {
    mode: fallbackMode,
    start: 0,
    width: fallbackMode.distributionPercent || 0,
  };
}

function ensureLaunchModeDistributionStructure() {
  const existingSegments = elements.launchModeDistributionBar.querySelectorAll(".launch-mode-modal__distribution-segment");
  if (existingSegments.length !== LEARNING_MODES.length) {
    const nextSegments = LEARNING_MODES.map((mode) => createLaunchModeDistributionSegment(mode, false));
    elements.launchModeDistributionBar.replaceChildren(elements.launchModeDistributionIndicator, ...nextSegments);
  }

  const existingLegendItems = elements.launchModeDistributionLegend.querySelectorAll(".launch-mode-modal__distribution-item");
  if (existingLegendItems.length !== LEARNING_MODES.length) {
    elements.launchModeDistributionLegend.replaceChildren(
      ...LEARNING_MODES.map((mode) => createLaunchModeDistributionLegendItem(mode, false)),
    );
  }
}

function createLaunchModeCard(subscription, mode) {
  const progress = getSubscriptionLearningModeProgress(subscription, mode.key);
  const isSelected = state.pendingLaunchModeKey === mode.key;

  const card = document.createElement("button");
  card.type = "button";
  card.className = "launch-mode-modal__mode-card";
  card.classList.toggle("is-selected", isSelected);
  card.classList.toggle("is-available", mode.isAvailable);
  card.classList.toggle("is-unavailable", !mode.isAvailable);
  card.disabled = !mode.isAvailable;
  card.dataset.modeKey = mode.key;
  card.setAttribute("aria-pressed", String(isSelected));
  setLearningModeAccentVariables(card, mode);
  if (mode.isAvailable) {
    card.addEventListener("click", () => {
      if (state.pendingLaunchModeKey === mode.key) {
        return;
      }

      const previousModeKey = state.pendingLaunchModeKey;
      state.pendingLaunchModeKey = mode.key;
      renderLaunchModeModal({ previousModeKey });
    });
  }

  const main = document.createElement("span");
  main.className = "launch-mode-modal__mode-main";

  const leading = document.createElement("span");
  leading.className = "launch-mode-modal__mode-leading";

  const label = document.createElement("strong");
  label.className = "launch-mode-modal__mode-label";
  label.textContent = mode.label;

  leading.append(createLaunchModeIcon(mode.iconPath), label);
  main.append(leading);
  if (mode.isAvailable) {
    main.append(createLaunchModeSummary(progress));
  }

  card.append(main);
  return card;
}

function renderLaunchModeCards(subscription, { forceRebuild = false } = {}) {
  const shouldRebuild = forceRebuild
    || elements.launchModeModes.childElementCount !== LEARNING_MODES.length
    || elements.launchModeModes.dataset.setPath !== state.pendingLaunchSetPath;

  if (shouldRebuild) {
    elements.launchModeModes.replaceChildren(...LEARNING_MODES.map((mode) => createLaunchModeCard(subscription, mode)));
    elements.launchModeModes.dataset.setPath = state.pendingLaunchSetPath;
    return;
  }

  for (const mode of LEARNING_MODES) {
    const card = elements.launchModeModes.querySelector(`[data-mode-key="${mode.key}"]`);
    if (!(card instanceof HTMLButtonElement)) {
      continue;
    }

    const isSelected = state.pendingLaunchModeKey === mode.key;
    card.classList.toggle("is-selected", isSelected);
    card.classList.toggle("is-available", mode.isAvailable);
    card.classList.toggle("is-unavailable", !mode.isAvailable);
    card.disabled = !mode.isAvailable;
    card.setAttribute("aria-pressed", String(isSelected));
    setLearningModeAccentVariables(card, mode);
  }
}

function createLaunchModeActionContent(mode, label) {
  const content = document.createElement("span");
  content.className = "launch-mode-modal__action-content";
  content.dataset.modeKey = mode.key;
  content.classList.toggle("is-disabled", !mode.isAvailable);
  // Keep accent colors on each face so the outgoing label can flip out
  // with its original styling while the incoming face flips in separately.
  setLearningModeAccentVariables(content, mode);
  content.textContent = label;
  return content;
}

function clearLaunchModeActionTransitionTimer() {
  if (state.launchModeActionTransitionTimerId !== null) {
    window.clearTimeout(state.launchModeActionTransitionTimerId);
    state.launchModeActionTransitionTimerId = null;
  }
}

function finishLaunchModeActionTransition() {
  clearLaunchModeActionTransitionTimer();

  const stage = elements.launchModeStartStage;
  if (!(stage instanceof HTMLElement)) {
    return;
  }

  const nextCurrent = stage.querySelector(".launch-mode-modal__action-content.is-incoming")
    || stage.querySelector(".launch-mode-modal__action-content.is-current")
    || stage.lastElementChild;

  if (!(nextCurrent instanceof HTMLElement)) {
    stage.replaceChildren();
    stage.style.height = "";
    return;
  }

  nextCurrent.className = "launch-mode-modal__action-content is-current";
  stage.replaceChildren(nextCurrent);
  stage.style.height = "";
}

function measureLaunchModeActionContentHeight(content) {
  const stage = elements.launchModeStartStage;
  if (!(stage instanceof HTMLElement)) {
    return 0;
  }

  content.classList.add("is-measuring");
  stage.append(content);
  const height = content.offsetHeight;
  content.remove();
  content.classList.remove("is-measuring");
  return height;
}

function updateLaunchModeActionButton({ previousModeKey = "", forceInstant = false } = {}) {
  const selectedMode = getLearningModeDefinition(state.pendingLaunchModeKey);
  const isAvailable = selectedMode.isAvailable;
  const nextLabel = isAvailable
    ? `${selectedMode.label} starten`
    : "Noch nicht verfügbar";

  setLearningModeAccentVariables(elements.launchModeStart, selectedMode);
  elements.launchModeStart.disabled = !isAvailable;
  elements.launchModeStart.setAttribute("aria-disabled", String(!isAvailable));

  const stage = elements.launchModeStartStage;
  if (!(stage instanceof HTMLElement)) {
    elements.launchModeStart.textContent = nextLabel;
    return;
  }

  finishLaunchModeActionTransition();

  const currentContent = stage.querySelector(".launch-mode-modal__action-content.is-current");
  const currentModeKey = currentContent?.dataset.modeKey || state.launchModeActionRenderedModeKey || "";
  const nextContent = createLaunchModeActionContent(selectedMode, nextLabel);
  const direction = getLaunchModeTransitionDirection(previousModeKey || currentModeKey, selectedMode.key);
  const shouldAnimate = !forceInstant
    && currentContent instanceof HTMLElement
    && currentModeKey
    && currentModeKey !== selectedMode.key
    && direction !== 0;

  if (!shouldAnimate) {
    nextContent.classList.add("is-current");
    stage.replaceChildren(nextContent);
    stage.style.height = "";
    state.launchModeActionRenderedModeKey = selectedMode.key;
    return;
  }

  const incomingDirectionClass = direction > 0 ? "from-right" : "from-left";
  const outgoingDirectionClass = direction > 0 ? "to-left" : "to-right";
  const currentHeight = currentContent.offsetHeight;
  const nextHeight = measureLaunchModeActionContentHeight(nextContent);

  stage.style.height = `${Math.max(currentHeight, nextHeight)}px`;

  currentContent.classList.remove("is-current");
  currentContent.classList.add("is-leaving", outgoingDirectionClass);

  nextContent.classList.add("is-incoming", incomingDirectionClass);
  stage.append(nextContent);

  void stage.offsetWidth;
  currentContent.classList.add("is-active");
  nextContent.classList.add("is-active");

  state.launchModeActionRenderedModeKey = selectedMode.key;
  state.launchModeActionTransitionTimerId = window.setTimeout(() => {
    finishLaunchModeActionTransition();
  }, 360);
}

function renderLaunchModeDistribution() {
  const selectedModeKey = state.pendingLaunchModeKey;
  ensureLaunchModeDistributionStructure();

  for (const segment of elements.launchModeDistributionBar.querySelectorAll(".launch-mode-modal__distribution-segment")) {
    segment.classList.toggle("is-selected", segment.dataset.modeKey === selectedModeKey);
  }

  for (const item of elements.launchModeDistributionLegend.querySelectorAll(".launch-mode-modal__distribution-item")) {
    item.classList.toggle("is-selected", item.dataset.modeKey === selectedModeKey);
  }

  const metrics = getLaunchModeDistributionMetrics(selectedModeKey);
  setLearningModeAccentVariables(elements.launchModeDistributionIndicator, metrics.mode);
  elements.launchModeDistributionBar.style.setProperty("--distribution-active-start", `${metrics.start}%`);
  elements.launchModeDistributionBar.style.setProperty("--distribution-active-width", `${metrics.width}%`);
}

function getLaunchModeOrderIndex(modeKey) {
  return LEARNING_MODE_KEYS.indexOf(normalizeLearningModeKey(modeKey));
}

function getLaunchModeTransitionDirection(previousModeKey, nextModeKey) {
  const previousIndex = getLaunchModeOrderIndex(previousModeKey);
  const nextIndex = getLaunchModeOrderIndex(nextModeKey);

  if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex) {
    return 0;
  }

  return nextIndex > previousIndex ? 1 : -1;
}

function createTestCardCountControl(subscription) {
  const { minimum, maximum } = getTestCardCountRange(subscription);
  const selectedCount = clampTestCardCount(state.pendingTestCardCount, subscription);
  state.pendingTestCardCount = selectedCount;

  const control = document.createElement("div");
  control.className = "launch-mode-modal__test-count";

  const heading = document.createElement("div");
  heading.className = "launch-mode-modal__test-count-heading";

  const label = document.createElement("label");
  label.className = "launch-mode-modal__test-count-label";
  label.textContent = "Umfang";

  const output = document.createElement("output");
  output.className = "launch-mode-modal__test-count-value";
  output.textContent = `${selectedCount} von ${maximum} Vokabeln`;

  const slider = document.createElement("input");
  slider.className = "launch-mode-modal__test-count-slider";
  slider.type = "range";
  slider.min = String(minimum);
  slider.max = String(maximum);
  slider.step = "1";
  slider.value = String(selectedCount);
  slider.setAttribute("aria-label", `Anzahl der Vokabeln, mindestens ${minimum}, höchstens ${maximum}`);
  slider.addEventListener("input", () => {
    state.pendingTestCardCount = clampTestCardCount(slider.value, subscription);
    output.textContent = `${state.pendingTestCardCount} von ${maximum} Vokabeln`;
  });

  heading.append(label, output);
  control.append(heading, slider);
  return control;
}

function createLaunchModeDetailContent(mode, progress, subscription) {
  const content = document.createElement("div");
  content.className = "launch-mode-modal__detail-content";
  content.dataset.modeKey = mode.key;

  const title = document.createElement("h3");
  title.className = "launch-mode-modal__detail-title";
  title.textContent = mode.label;

  const description = document.createElement("p");
  description.className = "launch-mode-modal__detail-description";
  description.textContent = mode.description;

  const meta = document.createElement("p");
  meta.className = "launch-mode-modal__detail-meta";
  meta.textContent = buildLaunchModeDetailMeta(mode, progress);
  meta.hidden = !meta.textContent;

  content.append(title, description, meta);
  return content;
}

function clearLaunchModeDetailTransitionTimer() {
  if (state.launchModeDetailTransitionTimerId !== null) {
    window.clearTimeout(state.launchModeDetailTransitionTimerId);
    state.launchModeDetailTransitionTimerId = null;
  }
}

function finishLaunchModeDetailTransition() {
  clearLaunchModeDetailTransitionTimer();

  const stage = elements.launchModeDetailStage;
  if (!(stage instanceof HTMLElement)) {
    return;
  }

  const nextCurrent = stage.querySelector(".launch-mode-modal__detail-content.is-incoming")
    || stage.querySelector(".launch-mode-modal__detail-content.is-current")
    || stage.lastElementChild;

  if (!(nextCurrent instanceof HTMLElement)) {
    stage.replaceChildren();
    stage.style.height = "";
    return;
  }

  nextCurrent.className = "launch-mode-modal__detail-content is-current";
  stage.replaceChildren(nextCurrent);
  stage.style.height = "";
}

function measureLaunchModeDetailContentHeight(content) {
  const stage = elements.launchModeDetailStage;
  if (!(stage instanceof HTMLElement)) {
    return 0;
  }

  content.classList.add("is-measuring");
  stage.append(content);
  const height = content.offsetHeight;
  content.remove();
  content.classList.remove("is-measuring");
  return height;
}

function renderLaunchModeDetail(subscription, { previousModeKey = "", forceInstant = false } = {}) {
  const selectedMode = getLearningModeDefinition(state.pendingLaunchModeKey);
  const progress = getSubscriptionLearningModeProgress(subscription, selectedMode.key);
  setLearningModeAccentVariables(elements.launchModeDetail, selectedMode);

  const stage = elements.launchModeDetailStage;
  if (!(stage instanceof HTMLElement)) {
    return;
  }

  finishLaunchModeDetailTransition();

  const currentContent = stage.querySelector(".launch-mode-modal__detail-content.is-current");
  const currentModeKey = currentContent?.dataset.modeKey || state.launchModeDetailRenderedModeKey || "";
  const nextContent = createLaunchModeDetailContent(selectedMode, progress, subscription);
  const direction = getLaunchModeTransitionDirection(previousModeKey || currentModeKey, selectedMode.key);
  const shouldAnimate = !forceInstant
    && currentContent instanceof HTMLElement
    && currentModeKey
    && currentModeKey !== selectedMode.key
    && direction !== 0;

  if (!shouldAnimate) {
    nextContent.classList.add("is-current");
    stage.replaceChildren(nextContent);
    stage.style.height = "";
    state.launchModeDetailRenderedModeKey = selectedMode.key;
    return;
  }

  const incomingDirectionClass = direction > 0 ? "from-right" : "from-left";
  const outgoingDirectionClass = direction > 0 ? "to-left" : "to-right";
  const currentHeight = currentContent.offsetHeight;
  const nextHeight = measureLaunchModeDetailContentHeight(nextContent);

  stage.style.height = `${Math.max(currentHeight, nextHeight)}px`;

  currentContent.classList.remove("is-current");
  currentContent.classList.add("is-leaving", outgoingDirectionClass);

  nextContent.classList.add("is-incoming", incomingDirectionClass);
  stage.append(nextContent);

  void stage.offsetWidth;
  currentContent.classList.add("is-active");
  nextContent.classList.add("is-active");

  state.launchModeDetailRenderedModeKey = selectedMode.key;
  state.launchModeDetailTransitionTimerId = window.setTimeout(() => {
    finishLaunchModeDetailTransition();
  }, 360);
}

function buildLaunchModeDetailMeta(mode, progress) {
  if (!mode.isAvailable) {
    return "Noch nicht freigeschaltet";
  }

  if (progress.completedRoundCount === 0) {
    return "Noch kein Durchgang";
  }

  return progress.completedRoundCount === 1 ? "1 Durchgang" : `${progress.completedRoundCount} Durchgänge`;
}

function renderLaunchModeModal({
  previousModeKey = "",
  forceRebuildCards = false,
  forceInstantDetail = false,
} = {}) {
  const subscription = getPendingLaunchSubscription();

  if (!subscription) {
    return;
  }

  elements.launchModeTitle.textContent = state.pendingLaunchSetTitle;
  elements.launchModeDescription.textContent = "Lernmodus waehlen.";
  renderLaunchModeDistribution();
  renderLaunchModeCards(subscription, { forceRebuild: forceRebuildCards });
  renderLaunchModeDetail(subscription, { previousModeKey, forceInstant: forceInstantDetail });
  updateLaunchModeActionButton({ previousModeKey, forceInstant: forceInstantDetail });
}

function openLaunchModeModal(setPath) {
  const subscription = state.subscriptions.find((entry) => entry?.setPath === setPath);
  state.pendingLaunchSetPath = setPath;
  state.pendingLaunchSetTitle = subscription?.title || setPath;
  state.pendingLaunchModeKey = getDefaultLaunchModeKey(subscription);
  state.pendingLaunchDirection = loadPreferredLearningDirection(setPath)
    || parseLearningDirection(subscription?.defaultDirection)
    || LEARNING_DIRECTIONS.SOURCE_TARGET;
  const { maximum } = getTestCardCountRange(subscription);
  state.pendingTestCardCount = Math.min(TEST_DEFAULT_CARD_COUNT, maximum);
  state.launchModeScrollY = window.scrollY || window.pageYOffset || 0;
  renderLaunchModeModal({
    forceRebuildCards: true,
    forceInstantDetail: true,
  });
  document.body.classList.add("launch-mode-modal-open");
  window.scrollTo(0, 0);
  elements.launchModeModal.scrollTop = 0;
  window.LerndeckUiMotion.show(elements.launchModeModal, { focus: elements.launchModePanel });
}

function getLaunchSettingsTitle(modeKey) {
  if (modeKey === "practice") return "Übungseinstellungen";
  if (modeKey === "write") return "Eingabeeinstellungen";
  if (modeKey === "test") return "Testeinstellungen";
  return "Lerneinstellungen";
}

function renderLaunchSettings(subscription, selectedMode) {
  elements.launchSettingsTitle.textContent = getLaunchSettingsTitle(selectedMode.key);
  elements.launchSettingsDescription.textContent = selectedMode.key === "test"
    ? "Wähle die Abfragerichtung und den Umfang."
    : "Wähle die Abfragerichtung.";
  elements.launchSettingsStartLabel.textContent = `${selectedMode.label} starten`;
  elements.launchSettingsAdditional.replaceChildren();
  elements.launchSettingsAdditional.hidden = selectedMode.key !== "test";
  if (selectedMode.key === "test") {
    const group = document.createElement("section");
    group.className = "launch-settings-modal__group";
    group.setAttribute("aria-label", "Testumfang");
    group.append(createTestCardCountControl(subscription));
    elements.launchSettingsAdditional.append(group);
  }
}

function openLaunchSettingsModal() {
  const subscription = getPendingLaunchSubscription();
  const selectedMode = getLearningModeDefinition(state.pendingLaunchModeKey);

  if (!subscription || !selectedMode.isAvailable || !isDirectionConfigurableMode(selectedMode.key)) {
    return;
  }

  renderLaunchSettings(subscription, selectedMode);
  setLearningModeAccentVariables(elements.launchSettingsPanel, selectedMode);
  setLearningModeAccentVariables(elements.launchModeDirection, selectedMode);
  setLearningModeAccentVariables(elements.launchSettingsStart, selectedMode);
  setLearningModeAccentVariables(elements.launchSettingsStartLabel, selectedMode);
  syncLearningDirectionGroup(
    "launch",
    state.pendingLaunchDirection,
    getSubscriptionDirectionMetadata(subscription),
  );
  elements.launchSettingsModal.scrollTop = 0;
  window.LerndeckUiMotion.swap(elements.launchModeModal, elements.launchSettingsModal, {
    focus: elements.launchSettingsPanel,
  });
}

function returnToLaunchModeModal() {
  elements.launchModeModal.scrollTop = 0;
  window.LerndeckUiMotion.swap(elements.launchSettingsModal, elements.launchModeModal, {
    focus: elements.launchModePanel,
  });
}

function clearLaunchModeModalContent() {
  elements.launchModeDistributionBar.replaceChildren(elements.launchModeDistributionIndicator);
  elements.launchModeDistributionLegend.replaceChildren();
  elements.launchModeModes.replaceChildren();
  delete elements.launchModeModes.dataset.setPath;
  elements.launchModeDetailStage.replaceChildren();
  elements.launchModeStartStage.replaceChildren();
  elements.launchSettingsAdditional.replaceChildren();
}

function closeLaunchModeModal() {
  const restoreScrollY = state.launchModeScrollY;
  finishLaunchModeDetailTransition();
  finishLaunchModeActionTransition();
  state.pendingLaunchSetPath = "";
  state.pendingLaunchSetTitle = "";
  state.pendingLaunchModeKey = DEFAULT_LEARNING_MODE_KEY;
  state.pendingLaunchDirection = LEARNING_DIRECTIONS.SOURCE_TARGET;
  state.pendingTestCardCount = TEST_DEFAULT_CARD_COUNT;
  state.launchModeScrollY = 0;
  state.launchModeDetailRenderedModeKey = "";
  state.launchModeActionRenderedModeKey = "";
  const activeModal = window.LerndeckUiMotion.isVisible(elements.launchSettingsModal)
    ? elements.launchSettingsModal
    : elements.launchModeModal;
  const inactiveModal = activeModal === elements.launchModeModal
    ? elements.launchSettingsModal
    : elements.launchModeModal;
  window.LerndeckUiMotion.hide(inactiveModal);
  window.LerndeckUiMotion.hide(activeModal, {
    after: () => {
      clearLaunchModeModalContent();
      document.body.classList.remove("launch-mode-modal-open");
      window.scrollTo(0, restoreScrollY);
    },
  });
}

function handleLaunchModeOverlayClick(event) {
  if (event.target === elements.launchModeModal) {
    closeLaunchModeModal();
  }
}

function handleLaunchSettingsOverlayClick(event) {
  if (event.target === elements.launchSettingsModal) {
    closeLaunchModeModal();
  }
}

async function handleLaunchModeStart() {
  if (!state.pendingLaunchSetPath) {
    closeLaunchModeModal();
    return;
  }

  const selectedMode = getLearningModeDefinition(state.pendingLaunchModeKey);
  if (!selectedMode.isAvailable) {
    updateLaunchModeActionButton();
    return;
  }

  if (isDirectionConfigurableMode(selectedMode.key)) {
    openLaunchSettingsModal();
    return;
  }

  await startPendingLaunchMode();
}

async function startPendingLaunchMode() {
  if (!state.pendingLaunchSetPath) {
    closeLaunchModeModal();
    return;
  }

  const selectedMode = getLearningModeDefinition(state.pendingLaunchModeKey);
  if (!selectedMode.isAvailable) {
    return;
  }

  const setPath = state.pendingLaunchSetPath;
  const selectedModeKey = state.pendingLaunchModeKey;
  const selectedDirection = state.pendingLaunchDirection;
  const selectedTestCardCount = clampTestCardCount(
    state.pendingTestCardCount,
    getPendingLaunchSubscription(),
  );
  if (isDirectionConfigurableMode(selectedModeKey)) {
    persistPreferredLearningDirection(setPath, selectedDirection);
  }
  closeLaunchModeModal();
  state.requestedSetPath = setPath;
  state.requestedSetUrl = new URL(setPath, getAppBaseUrl()).href;
  window.history.replaceState({}, "", buildCanonicalStudentSetUrl(setPath));
  if (selectedModeKey === "test") {
    await startTestSet(
      setPath,
      new URL(setPath, getAppBaseUrl()).href,
      selectedDirection,
      selectedTestCardCount,
    );
    return;
  }

  if (selectedModeKey === "write") {
    await startInputSet(
      setPath,
      new URL(setPath, getAppBaseUrl()).href,
      selectedModeKey,
      selectedDirection,
    );
    return;
  }

  await startFlashcardSet(
    setPath,
    new URL(setPath, getAppBaseUrl()).href,
    selectedModeKey,
    selectedDirection,
  );
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
    feedback: result.ok ? "Deck entfernt." : result.error,
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

function loadTabletSession(tabletId = loadLocalTabletId()) {
  try {
    const rawValue = loadPersistentStorageItem(TABLET_SESSION_STORAGE_KEY);

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

  persistPersistentStorageItem(TABLET_SESSION_STORAGE_KEY, JSON.stringify({
    tabletId,
    token,
  }));
}

function clearTabletSession() {
  clearPersistentStorageItem(TABLET_SESSION_STORAGE_KEY);
}

function loadActiveLearningSession() {
  try {
    const rawValue = loadPersistentStorageItem(ACTIVE_LEARNING_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const setPath = normalizeSetPath(parsed?.setPath);

    if (!setPath) {
      return null;
    }

    return {
      setPath,
      modeKey: normalizeLearningModeKey(parsed?.modeKey),
      appMode: parsed?.appMode === APP_MODES.INPUT
        ? APP_MODES.INPUT
        : parsed?.appMode === APP_MODES.TEST
          ? APP_MODES.TEST
          : APP_MODES.FLASHCARD,
      testCardCount: Number.isFinite(parsed?.testCardCount)
        ? Math.max(1, Math.floor(parsed.testCardCount))
        : TEST_DEFAULT_CARD_COUNT,
      direction: normalizeLearningDirection(parsed?.direction),
    };
  } catch (error) {
    console.error("Unable to load active learning session:", error);
    return null;
  }
}

function persistActiveLearningSession(
  setPath,
  modeKey,
  appMode,
  direction = LEARNING_DIRECTIONS.SOURCE_TARGET,
  testCardCount = TEST_DEFAULT_CARD_COUNT,
) {
  const normalizedSetPath = normalizeSetPath(setPath);

  if (!normalizedSetPath) {
    clearActiveLearningSession();
    return;
  }

  persistPersistentStorageItem(ACTIVE_LEARNING_SESSION_STORAGE_KEY, JSON.stringify({
    setPath: normalizedSetPath,
    modeKey: normalizeLearningModeKey(modeKey),
    appMode: appMode === APP_MODES.INPUT
      ? APP_MODES.INPUT
      : appMode === APP_MODES.TEST
        ? APP_MODES.TEST
        : APP_MODES.FLASHCARD,
    direction: normalizeLearningDirection(direction),
    testCardCount: Math.max(1, Math.floor(testCardCount)),
  }));
}

function clearActiveLearningSession() {
  clearPersistentStorageItem(ACTIVE_LEARNING_SESSION_STORAGE_KEY);
}

function hasUnlockedStudentSession() {
  return loadPersistentStorageItem(SESSION_UNLOCK_KEY) === "1";
}

function persistStudentSessionUnlock() {
  persistPersistentStorageItem(SESSION_UNLOCK_KEY, "1");
}

function clearStudentSessionUnlock() {
  clearPersistentStorageItem(SESSION_UNLOCK_KEY);
}

async function resumeActiveLearningSession(setPath) {
  const activeSession = loadActiveLearningSession();

  if (!activeSession || activeSession.setPath !== setPath) {
    return false;
  }

  const setUrl = new URL(setPath, getAppBaseUrl()).href;
  state.requestedSetPath = setPath;
  state.requestedSetUrl = setUrl;

  if (activeSession.appMode === APP_MODES.TEST || activeSession.modeKey === "test") {
    await startTestSet(
      setPath,
      setUrl,
      activeSession.direction,
      activeSession.testCardCount,
    );
    return true;
  }

  if (activeSession.appMode === APP_MODES.INPUT || activeSession.modeKey === "write") {
    await startInputSet(setPath, setUrl, activeSession.modeKey, activeSession.direction);
    return true;
  }

  await startFlashcardSet(setPath, setUrl, activeSession.modeKey, activeSession.direction);
  return true;
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
    const subscriptions = Array.isArray(response.data?.subscriptions) ? response.data.subscriptions : [];
    const subscriptionsWithLocalMetadata = await mergeLocalSetMetadataIntoSubscriptions(subscriptions);

    return {
      ok: true,
      status: response.status,
      tablet: response.data?.tablet || null,
      subscriptions: mergeTabletSetColorPreferences(tabletId, subscriptionsWithLocalMetadata)
        .map((subscription) => normalizeSubscriptionLearningProgress(subscription)),
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

async function mergeLocalSetMetadataIntoSubscriptions(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return [];
  }

  return Promise.all(subscriptions.map(async (subscription) => {
    const localMetadata = await loadLocalSetMetadata(subscription?.setPath);

    if (!localMetadata) {
      return subscription;
    }

    const nextTitle = typeof subscription?.title === "string" && subscription.title.trim()
      ? subscription.title.trim()
      : localMetadata.title;
    const nextSubject = typeof subscription?.subject === "string" && subscription.subject.trim()
      ? subscription.subject.trim()
      : localMetadata.subject;
    const nextDescription = typeof subscription?.description === "string" && subscription.description.trim()
      ? subscription.description.trim()
      : localMetadata.description;
    const nextCardCount = Number.isFinite(subscription?.cardCount) ? subscription.cardCount : localMetadata.cardCount;
    const nextSourceLabel = typeof subscription?.sourceLabel === "string" && subscription.sourceLabel.trim()
      ? subscription.sourceLabel.trim()
      : localMetadata.sourceLabel;
    const nextTargetLabel = typeof subscription?.targetLabel === "string" && subscription.targetLabel.trim()
      ? subscription.targetLabel.trim()
      : localMetadata.targetLabel;
    const nextDefaultDirection = parseLearningDirection(subscription?.defaultDirection)
      || localMetadata.defaultDirection;

    if (
      nextTitle === subscription?.title
      && nextSubject === subscription?.subject
      && nextDescription === subscription?.description
      && nextCardCount === subscription?.cardCount
      && nextSourceLabel === subscription?.sourceLabel
      && nextTargetLabel === subscription?.targetLabel
      && nextDefaultDirection === subscription?.defaultDirection
    ) {
      return subscription;
    }

    return {
      ...subscription,
      title: nextTitle,
      subject: nextSubject,
      description: nextDescription,
      cardCount: nextCardCount,
      sourceLabel: nextSourceLabel,
      targetLabel: nextTargetLabel,
      defaultDirection: nextDefaultDirection,
    };
  }));
}

function normalizeLearningModeKey(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return LEARNING_MODE_KEYS.includes(normalizedValue) ? normalizedValue : DEFAULT_LEARNING_MODE_KEY;
}

function getLearningModeDefinition(modeKey) {
  return LEARNING_MODES.find((entry) => entry.key === modeKey) || LEARNING_MODES.find((entry) => entry.key === DEFAULT_LEARNING_MODE_KEY) || LEARNING_MODES[0];
}

function createEmptyLearningModeProgressEntry() {
  return {
    completedRoundCount: 0,
    averageScorePercent: null,
    lastRoundPercent: null,
    updatedAt: null,
  };
}

function createEmptyLearningModeProgressMap() {
  return Object.fromEntries(LEARNING_MODE_KEYS.map((modeKey) => [modeKey, createEmptyLearningModeProgressEntry()]));
}

function normalizeLearningModeProgressEntry(value) {
  return {
    completedRoundCount: Number.isFinite(value?.completedRoundCount)
      ? Math.max(0, Math.floor(value.completedRoundCount))
      : 0,
    averageScorePercent: Number.isFinite(value?.averageScorePercent)
      ? Math.max(0, Math.min(100, Math.round(value.averageScorePercent)))
      : null,
    lastRoundPercent: Number.isFinite(value?.lastRoundPercent)
      ? Math.max(0, Math.min(100, Math.round(value.lastRoundPercent)))
      : null,
    updatedAt: typeof value?.updatedAt === "string" && value.updatedAt.trim()
      ? value.updatedAt.trim()
      : null,
  };
}

function normalizeSubscriptionLearningModeProgress(subscription) {
  const nextProgress = createEmptyLearningModeProgressMap();

  if (subscription?.modeProgress && typeof subscription.modeProgress === "object" && !Array.isArray(subscription.modeProgress)) {
    for (const modeKey of LEARNING_MODE_KEYS) {
      nextProgress[modeKey] = normalizeLearningModeProgressEntry(subscription.modeProgress[modeKey]);
    }
  }

  const practiceProgress = nextProgress[DEFAULT_LEARNING_MODE_KEY];
  const legacyRoundCount = Number.isFinite(subscription?.completedRoundCount)
    ? Math.max(0, Math.floor(subscription.completedRoundCount))
    : 0;
  const legacyAverageScorePercent = Number.isFinite(subscription?.averageScorePercent)
    ? Math.max(0, Math.min(100, Math.round(subscription.averageScorePercent)))
    : null;
  const legacyLastRoundPercent = Number.isFinite(subscription?.lastRoundPercent)
    ? Math.max(0, Math.min(100, Math.round(subscription.lastRoundPercent)))
    : null;

  if (
    practiceProgress.completedRoundCount < 1
    && practiceProgress.averageScorePercent === null
    && practiceProgress.lastRoundPercent === null
  ) {
    nextProgress[DEFAULT_LEARNING_MODE_KEY] = {
      completedRoundCount: legacyRoundCount,
      averageScorePercent: legacyAverageScorePercent ?? (legacyRoundCount === 1 ? legacyLastRoundPercent : null),
      lastRoundPercent: legacyLastRoundPercent,
      updatedAt: practiceProgress.updatedAt,
    };
  }

  return nextProgress;
}

function normalizeSubscriptionLearningProgress(subscription) {
  const modeProgress = normalizeSubscriptionLearningModeProgress(subscription);
  const practiceProgress = modeProgress[DEFAULT_LEARNING_MODE_KEY];

  return {
    ...subscription,
    completedRoundCount: practiceProgress.completedRoundCount,
    averageScorePercent: practiceProgress.averageScorePercent,
    lastRoundPercent: practiceProgress.lastRoundPercent,
    modeProgress,
  };
}

function getSubscriptionLearningModeProgress(subscription, modeKey) {
  const normalizedModeKey = normalizeLearningModeKey(modeKey);
  const modeProgress = subscription?.modeProgress || normalizeSubscriptionLearningProgress(subscription).modeProgress;
  return modeProgress[normalizedModeKey] || createEmptyLearningModeProgressEntry();
}

function getDefaultLaunchModeKey(subscription) {
  void subscription;
  const preferredMode = getLearningModeDefinition(DEFAULT_LEARNING_MODE_KEY);

  if (preferredMode?.isAvailable) {
    return preferredMode.key;
  }

  const availableMode = LEARNING_MODES.find((entry) => entry.isAvailable);
  return availableMode?.key || DEFAULT_LEARNING_MODE_KEY;
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
        error: getApiErrorMessage(response, "Deck konnte nicht hinzugefügt werden."),
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

async function saveTabletSubscriptionCardColor(tabletId, setPath, cardColor) {
  if (!tabletId || !setPath || !cardColor) {
    return {
      ok: false,
      authRequired: false,
      cardColor: "",
      error: "Kartenfarbe konnte nicht gespeichert werden.",
    };
  }

  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/subscriptions/card-color`, {
      auth: "tablet",
      tabletId,
      method: "PATCH",
      body: {
        setPath,
        cardColor,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await handleExpiredTabletSession(tabletId);
        return {
          ok: false,
          authRequired: true,
          cardColor: "",
          error: getApiErrorMessage(response, "Sitzung abgelaufen. Bitte erneut mit PIN anmelden."),
        };
      }

      return {
        ok: false,
        authRequired: false,
        cardColor: "",
        error: getApiErrorMessage(response, "Kartenfarbe konnte nicht gespeichert werden."),
      };
    }

    return {
      ok: true,
      authRequired: false,
      cardColor: typeof response.data?.subscription?.cardColor === "string"
        ? response.data.subscription.cardColor
        : cardColor,
      error: "",
    };
  } catch (error) {
    console.error("Unable to save tablet subscription card color:", error);
    return {
      ok: false,
      authRequired: false,
      cardColor: "",
      error: "Server nicht erreichbar. Bitte erneut versuchen.",
    };
  }
}

function loadTabletSetColorPreferences() {
  try {
    const rawValue = window.localStorage.getItem(TABLET_SET_COLOR_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const nextValue = {};

    for (const [tabletId, rawEntries] of Object.entries(parsed)) {
      const normalizedTabletId = typeof tabletId === "string" ? tabletId.trim() : "";

      if (!normalizedTabletId || !rawEntries || typeof rawEntries !== "object" || Array.isArray(rawEntries)) {
        continue;
      }

      const nextEntries = {};

      for (const [setPath, rawColor] of Object.entries(rawEntries)) {
        const normalizedSetPath = typeof setPath === "string" ? setPath.trim() : "";
        const normalizedColor = typeof rawColor === "string" ? rawColor.trim().toLowerCase() : "";

        if (
          normalizedSetPath
          && normalizedColor
          && STUDENT_SET_COLOR_PALETTE.some((entry) => entry.key === normalizedColor)
        ) {
          nextEntries[normalizedSetPath] = normalizedColor;
        }
      }

      if (Object.keys(nextEntries).length > 0) {
        nextValue[normalizedTabletId] = nextEntries;
      }
    }

    return nextValue;
  } catch (error) {
    console.error("Unable to load tablet set color preferences:", error);
    return {};
  }
}

function persistTabletSetColorPreferences(preferences) {
  try {
    window.localStorage.setItem(TABLET_SET_COLOR_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Unable to persist tablet set color preferences:", error);
  }
}

function saveLocalTabletSetColorPreference(tabletId, setPath, colorKey) {
  if (!tabletId || !setPath || !colorKey) {
    return;
  }

  const preferences = loadTabletSetColorPreferences();
  const nextTabletPreferences = {
    ...(preferences[tabletId] || {}),
    [setPath]: colorKey,
  };

  preferences[tabletId] = nextTabletPreferences;
  persistTabletSetColorPreferences(preferences);
}

function mergeTabletSetColorPreferences(tabletId, subscriptions) {
  if (!tabletId || !Array.isArray(subscriptions) || subscriptions.length === 0) {
    return subscriptions;
  }

  const preferences = loadTabletSetColorPreferences();
  const tabletPreferences = preferences[tabletId] || {};

  return subscriptions.map((subscription) => {
    const localColor = tabletPreferences[subscription?.setPath] || "";

    if (!localColor || typeof subscription?.cardColor === "string" && subscription.cardColor.trim()) {
      return subscription;
    }

    return {
      ...subscription,
      cardColor: localColor,
    };
  });
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
        error: getApiErrorMessage(response, "Deck konnte nicht entfernt werden."),
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
    syncAccessSessionState(response.data?.accessSession || null);

    if (response.ok) {
      persistTabletSession(tabletId, response.data?.session?.token || "");
      syncActiveTabletContext(response.data?.tablet || null);
      await continueAfterDeviceAccess(tabletId);
      return;
    }

    if (response.status === 409) {
      clearActiveLearningSession();
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
      loginTabletId: state.accessSession?.tabletId || tabletId,
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
      loginTabletId: state.accessSession?.tabletId || tabletId,
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

async function incrementTabletCompletedRounds(tabletId, setPath, {
  incrementBy = 1,
  modeKey = DEFAULT_LEARNING_MODE_KEY,
  lastRoundPercent = null,
} = {}) {
  try {
    const response = await apiRequest(`/api/tablets/${encodeURIComponent(tabletId)}/learning-progress/rounds`, {
      auth: "tablet",
      tabletId,
      method: "POST",
      body: {
        setPath,
        incrementBy,
        modeKey: normalizeLearningModeKey(modeKey),
        lastRoundPercent,
      },
    });

    if (response.status === 409) {
      await handleDecoupledTabletState(tabletId);
      return {
        ok: false,
        decoupled: true,
        authRequired: false,
      };
    }

    if (response.status === 401 || response.status === 403) {
      await handleExpiredTabletSession(tabletId);
      return {
        ok: false,
        decoupled: false,
        authRequired: true,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        decoupled: false,
        authRequired: false,
      };
    }

    syncActiveTabletContext(response.data?.tablet || null);
    return {
      ok: true,
      decoupled: false,
      authRequired: false,
    };
  } catch (error) {
    console.error("Unable to save completed rounds:", error);
    return {
      ok: false,
      decoupled: false,
      authRequired: false,
    };
  }
}

async function persistCompletedRoundCount({
  incrementBy = 1,
  modeKey = state.activeLearningModeKey || DEFAULT_LEARNING_MODE_KEY,
  lastRoundPercent = null,
} = {}) {
  const tabletId = loadLocalTabletId();
  const setPath = state.currentSetPath;

  if (!tabletId || !setPath || incrementBy < 1) {
    return;
  }

  await incrementTabletCompletedRounds(tabletId, setPath, {
    incrementBy,
    modeKey,
    lastRoundPercent,
  });
}

async function handleDecoupledTabletState(tabletId) {
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  clearActiveLearningSession();
  clearLocalTabletId();
  clearStudentSessionUnlock();
  clearTabletSession();
  clearActiveTabletContext();
  resetTabletDirectoryCache();
  await ensureTabletDirectoryLoaded();
  renderAccessState({
    loginTabletId: "",
    registrationTabletId: tabletId,
    registrationFeedback: "Dieses Tablet wurde entkoppelt. Eine neue Registrierung startet ohne Decks und ohne Lernstände.",
    showRegistration: true,
  });
}

async function handleExpiredTabletSession(tabletId, feedback = "Sitzung abgelaufen. Bitte PIN erneut eingeben.") {
  state.currentSetPath = "";
  state.currentSetUrl = "";
  state.currentSetBaseUrl = "";
  state.currentSetLanguageLabels = null;
  state.baseCards = [];
  state.allCards = [];
  clearActiveLearningSession();
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

function orientLearningCards(cards, direction) {
  const useReverse = normalizeLearningDirection(direction) === LEARNING_DIRECTIONS.TARGET_SOURCE;
  return cards.map((card) => useReverse && card.reverse ? {
    ...card.reverse,
    reverse: card,
  } : card);
}

function buildGeneratedHintReplacement(answer, revealFirstLetter) {
  let firstLetterRevealed = false;

  return Array.from(answer).map((character) => {
    if (!/[\p{L}\p{N}]/u.test(character)) {
      return character;
    }

    if (revealFirstLetter && !firstLetterRevealed) {
      firstLetterRevealed = true;
      return character;
    }

    return "_";
  }).join("");
}

function buildAnswerOnlyHints(answer) {
  return [false, true].map((revealFirstLetter) => buildHintData({
    exampleText: answer,
    targetText: answer,
    acceptedAnswers: [],
    replacement: buildGeneratedHintReplacement(answer, revealFirstLetter),
    preferAcceptedAnswers: false,
  }));
}

function buildCardData(card) {
  const rawSourceText = card?.source?.text?.trim();
  const rawTargetText = card?.target?.text?.trim();
  const audioSource = normalizeAudioPath(card?.audio?.source);
  const audioTarget = normalizeAudioPath(card?.audio?.target);
  const flashcardHintData = card?.hintData?.flashcard;
  const exampleId = flashcardHintData?.exampleId?.trim();
  const maskedWord = flashcardHintData?.maskedWord?.trim();
  const firstLetterHint = flashcardHintData?.firstLetterHint?.trim();

  if (
    typeof rawSourceText !== "string" ||
    typeof rawTargetText !== "string" ||
    rawSourceText === "" ||
    rawTargetText === ""
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
  const sourceExampleText = example?.source?.trim();

  if (!exampleText) {
    throw new Error("First card is missing the example referenced by hintData.flashcard.");
  }

  const acceptedAnswers = Array.isArray(card.acceptedAnswers)
    ? card.acceptedAnswers
        .filter((answer) => typeof answer === "string")
        .map((answer) => answer.trim())
        .filter(Boolean)
    : [];
  const answers = buildAcceptedAnswerList(rawTargetText, acceptedAnswers);
  const sourceAnswers = buildAcceptedAnswerList(rawSourceText);
  const sourceText = sourceAnswers[0] || rawSourceText;
  const sourceAlternatives = sourceAnswers.slice(1);
  const targetText = answers[0] || rawTargetText;
  const targetAlternatives = answers.slice(1);
  const irregularVerbAnswerGroups = window.LerndeckIrregularVerbs.buildAnswerGroups(
    targetText,
    targetAlternatives,
  );
  const sourceIrregularVerbAnswerGroups = window.LerndeckIrregularVerbs.buildAnswerGroups(
    sourceText,
    sourceAlternatives,
  );
  const exampleIsAnswerOnly = isAnswerOnlyExample(
    exampleText,
    [rawTargetText, ...acceptedAnswers, ...answers],
  );
  const hintExampleText = exampleIsAnswerOnly ? targetText : exampleText;
  const sourceExampleIsAnswerOnly = isAnswerOnlyExample(sourceExampleText, sourceAnswers);
  const reverseCard = {
    id: card?.id?.trim() || sourceText,
    sourceText: targetText,
    sourceAlternatives: targetAlternatives,
    targetText: sourceText,
    targetAlternatives: sourceAlternatives,
    answers: sourceAnswers,
    irregularVerbAnswerGroups: sourceIrregularVerbAnswerGroups,
    backContext: !sourceExampleText || sourceExampleIsAnswerOnly
      ? null
      : buildBackContextData({
          exampleText: sourceExampleText,
          targetText: sourceText,
          acceptedAnswers: sourceAlternatives,
        }),
    hints: buildAnswerOnlyHints(sourceText),
    audioSource: audioTarget,
    audioTarget: audioSource,
    visual: normalizeLearningVisual(card?.visual),
  };

  return {
    id: card?.id?.trim() || sourceText,
    sourceText,
    sourceAlternatives,
    targetText,
    targetAlternatives,
    answers,
    irregularVerbAnswerGroups,
    backContext: exampleIsAnswerOnly
      ? null
      : buildBackContextData({
          exampleText,
          targetText,
          acceptedAnswers: targetAlternatives,
        }),
    hints: [
      buildHintData({
        exampleText: hintExampleText,
        targetText,
        acceptedAnswers: targetAlternatives,
        replacement: maskedWord,
        preferAcceptedAnswers: false,
      }),
      buildHintData({
        exampleText: hintExampleText,
        targetText,
        acceptedAnswers: targetAlternatives,
        replacement: firstLetterHint,
        preferAcceptedAnswers: true,
      }),
    ],
    audioSource,
    audioTarget,
    visual: normalizeLearningVisual(card?.visual),
    reverse: reverseCard,
  };
}

function normalizeLearningVisual(value) {
  const url = typeof value?.url === "string" ? value.url.trim() : "";
  if (!url) {
    return null;
  }
  let resolvedUrl = url;
  try {
    resolvedUrl = new URL(url, getAppBaseUrl()).href;
  } catch (_error) {
    return null;
  }
  return {
    url: resolvedUrl,
    alt: typeof value.alt === "string" ? value.alt.trim() : "",
  };
}

function buildAcceptedAnswerList(targetText, acceptedAnswers = []) {
  const values = [targetText, ...acceptedAnswers];
  const seen = new Set();
  const answers = [];

  for (const value of values.flatMap((value) => splitAnswerVariants(value))) {
    const normalizedValue = normalizeInputAnswerValue(value);

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    answers.push(value.trim());
  }

  return answers;
}

function splitAnswerVariants(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(";")
    .map((answer) => answer.trim())
    .filter(Boolean);
}

function isAnswerOnlyExample(exampleText, answers) {
  const normalizedExample = normalizeInputAnswerValue(exampleText);

  return Boolean(normalizedExample) && answers.some((answer) => (
    normalizeInputAnswerValue(answer) === normalizedExample
  ));
}

function normalizeInputAnswerValue(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function calculateLevenshteinDistance(source, target) {
  const left = normalizeInputAnswerValue(source);
  const right = normalizeInputAnswerValue(target);

  if (left === right) {
    return 0;
  }

  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function getInputAlmostDistanceLimit(answerLength) {
  if (answerLength >= 9) {
    return 2;
  }

  if (answerLength >= 5) {
    return 1;
  }

  return 0;
}

function evaluateInputAnswer(input, answers) {
  const normalizedInput = normalizeInputAnswerValue(input);
  const validAnswers = Array.isArray(answers)
    ? answers
        .filter((answer) => typeof answer === "string")
        .map((answer) => answer.trim())
        .filter(Boolean)
    : [];
  const normalizedAnswers = validAnswers.map((answer) => ({
    raw: answer,
    normalized: normalizeInputAnswerValue(answer),
  }));

  if (normalizedAnswers.length === 0) {
    return {
      status: "wrong",
      normalizedInput,
      bestAnswer: "",
      distance: null,
    };
  }

  const exactAnswer = normalizedAnswers.find((answer) => answer.normalized === normalizedInput);
  if (exactAnswer) {
    return {
      status: "correct",
      normalizedInput,
      bestAnswer: exactAnswer.raw,
      distance: 0,
    };
  }

  let bestMatch = normalizedAnswers[0];
  let bestDistance = calculateLevenshteinDistance(normalizedInput, bestMatch.normalized);

  for (const answer of normalizedAnswers.slice(1)) {
    const distance = calculateLevenshteinDistance(normalizedInput, answer.normalized);

    if (distance < bestDistance) {
      bestMatch = answer;
      bestDistance = distance;
    }
  }

  const almostDistanceLimit = getInputAlmostDistanceLimit(bestMatch.normalized.length);
  const hasSameFirstLetter = normalizedInput[0] && bestMatch.normalized[0] && normalizedInput[0] === bestMatch.normalized[0];
  const isAlmost = almostDistanceLimit > 0 && bestDistance > 0 && bestDistance <= almostDistanceLimit && hasSameFirstLetter;

  return {
    status: isAlmost ? "almost" : "wrong",
    normalizedInput,
    bestAnswer: bestMatch.raw,
    distance: bestDistance,
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
  const displayReplacement = formatLearningTermInline(replacement);

  for (const candidate of candidates) {
    const hintData = splitHintText(exampleText, candidate, displayReplacement);

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
  const irregularVerbForms = getIrregularVerbForms(targetText) || [];
  const bareInfinitive = targetText.toLowerCase().startsWith("to ")
    ? targetText.slice(3).trim()
    : "";
  const orderedValues = preferAcceptedAnswers
    ? [...acceptedAnswers, targetText, ...irregularVerbForms, bareInfinitive]
    : [targetText, ...irregularVerbForms, ...acceptedAnswers, bareInfinitive];

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

function shouldHandleInputEnterShortcut(event) {
  if (!(event.target instanceof Element)) {
    return true;
  }

  const interactiveTarget = event.target.closest("button, a, input, select, textarea, [role=\"button\"]");
  return !interactiveTarget
    || interactiveTarget === elements.inputAnswerField
    || getInputVerbFields().includes(interactiveTarget);
}

function handleWindowKeydown(event) {
  if (state.flashcardSettingsOpen && event.key === "Escape") {
    event.preventDefault();
    closeFlashcardSettingsMenu();
    return;
  }

  if (state.inputSettingsOpen && event.key === "Escape") {
    event.preventDefault();
    closeInputSettingsMenu();
    return;
  }

  if (state.appMode === APP_MODES.ACCESS && state.accessShareExpanded && event.key === "Escape") {
    event.preventDefault();
    closeStudentShareModal();
    return;
  }

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

  if (elements.launchSettingsModal && !elements.launchSettingsModal.hidden && event.key === "Escape") {
    event.preventDefault();
    returnToLaunchModeModal();
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

  if (
    state.appMode === APP_MODES.INPUT
    && event.key === "Enter"
    && !event.repeat
    && shouldHandleInputEnterShortcut(event)
  ) {
    if (hasPendingInputAdvance()) {
      event.preventDefault();
      void handleInputAdvance();
      return;
    }

    if (state.inputSession.isComplete) {
      event.preventDefault();
      void handleInputAdvance();
      return;
    }
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

function canPerformSwipeAction(action) {
  return action === "known" || action === "unknown";
}

function getSwipeActionFromDelta(deltaX) {
  return deltaX > 0 ? "known" : "unknown";
}

function getSwipeTintRgb(deltaX) {
  return deltaX >= 0 ? "112 146 121" : "154 103 98";
}

function getSwipeSettleTintRgb(action) {
  return action === "known" ? "112 146 121" : "154 103 98";
}

function getSwipeStatusLabel(action) {
  if (action === "known") {
    return "Known.";
  }

  if (action === "unknown") {
    return "Unknown.";
  }

  return "Unknown.";
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
  const currentRoundPercent = getRoundResultPercent(state.cards.length, state.roundUnknownCards.length);

  if (!isLastCardInRound) {
    goToNextCard();
    return;
  }

  void persistCompletedRoundCount({
    lastRoundPercent: currentRoundPercent,
  });

  if (state.roundUnknownCards.length > 0) {
    renderRoundSummaryState();
    return;
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

function handleCardSecondaryAction(event) {
  markControlInteraction();
  event.preventDefault();
  event.stopPropagation();

  if (event.currentTarget?.dataset?.action === "restart-learning") {
    restartLearningSession();
  }
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

function getRoundResultPercent(cardCount, unknownCount) {
  if (!Number.isFinite(cardCount) || cardCount < 1) {
    return null;
  }

  const knownCount = cardCount - (Number.isFinite(unknownCount) ? unknownCount : 0);
  return Math.round((clamp(knownCount, 0, cardCount) / cardCount) * 100);
}

function startRound(cards, roundNumber, roundMode = "main") {
  state.cards = shuffleCards(cards);
  state.roundMode = roundMode;
  state.roundNumber = roundNumber;
  state.roundUnknownCards = [];
  state.isComplete = false;
  state.summaryMode = null;
  state.pendingNextRoundCards = [];
  state.pendingNextRoundNumber = null;
  state.summaryRoundKnownCount = 0;
  state.summaryRoundUnknownCount = 0;
  state.currentIndex = 0;
  state.currentCard = state.cards[0];
  resetCurrentCardState();
  renderCard();
}

function restartLearningSession() {
  state.roundMode = "main";
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

function canNavigateNext() {
  return state.currentIndex < state.cards.length - 1;
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
  const swipeAction = getSwipeActionFromDelta(state.swipeDeltaX);

  state.suppressNextClick = state.swipeMoved;
  state.swipeActive = false;
  state.swipePointerId = null;
  elements.flashcard.classList.remove("is-swipe-armed");

  if (shouldEvaluate && canPerformSwipeAction(swipeAction)) {
    settleSwipe(swipeAction);
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
  const tintRgb = getSwipeTintRgb(limitedX);

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
  const settledPositive = result === "known";
  const resolvedExitX = `${(settledPositive ? 1 : -1) * Math.max(cardWidth * 1.08, 320)}px`;
  const exitTilt = settledPositive ? "10deg" : "-10deg";

  elements.flashcard.classList.remove("is-swipe-dragging");
  elements.flashcard.classList.add("is-swipe-settling");
  elements.flashcardMotion.style.setProperty("--swipe-x", resolvedExitX);
  elements.flashcardMotion.style.setProperty("--swipe-y", exitY);
  elements.flashcardMotion.style.setProperty("--swipe-tilt", exitTilt);
  elements.flashcard.style.setProperty("--swipe-content-opacity", "0.22");
  elements.flashcard.style.setProperty("--swipe-tint-rgb", getSwipeSettleTintRgb(result));
  elements.flashcard.style.setProperty("--swipe-tint-opacity", "0.215");
  elements.statusMessage.textContent = getSwipeStatusLabel(result);

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
  renderFlashcardAnswer(elements.frontWord, elements.frontAlternatives, "\u00a0");
  renderFlashcardAnswer(elements.backWord, elements.backAlternatives, "\u00a0");
  elements.frontHint.textContent = "";
  renderBackContext(null);
  elements.frontHint.classList.remove("is-summary");
  elements.frontHint.classList.remove("is-visible");
  elements.statusMessage.textContent = "Lade Set.";
  updateAudioButtons();
  updateEvalButtons();
  updateCardSecondaryAction();
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
  renderFlashcardAnswer(elements.frontWord, elements.frontAlternatives, "Runde fertig");
  renderFlashcardAnswer(elements.backWord, elements.backAlternatives, "Runde fertig");
  renderBackContext(null);
  renderRoundSummary();
  elements.frontHint.classList.add("is-summary", "is-visible");
  elements.statusMessage.textContent = getRoundSummaryStatusMessage();
  elements.flashcard.setAttribute("aria-label", getRoundSummaryCardLabel());
  elements.cardAction.setAttribute("aria-label", "Weiter.");
  updateAudioButtons();
  updateEvalButtons();
  updateCardSecondaryAction();
  updateOutcomeCounters();
  updateProgressState({
    hidden: false,
    label: getRoundSummaryProgressLabel(),
    value: 100,
  });
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
  renderFlashcardAnswer(elements.frontWord, elements.frontAlternatives, "Fertig");
  renderFlashcardAnswer(elements.backWord, elements.backAlternatives, "Fertig");
  renderBackContext(null);
  renderCompletionSummary();
  elements.frontHint.classList.add("is-summary");
  elements.frontHint.classList.add("is-visible");
  elements.statusMessage.textContent = getCompletionStatusMessage();
  elements.flashcard.setAttribute("aria-label", getCompletionCardLabel());
  elements.cardAction.setAttribute("aria-label", "Neu starten.");
  updateAudioButtons();
  updateEvalButtons();
  updateCardSecondaryAction();
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
    sourceAlternatives,
    targetText,
    targetAlternatives,
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

  renderFlashcardAnswer(
    elements.frontWord,
    elements.frontAlternatives,
    sourceText,
    sourceAlternatives,
  );
  renderFlashcardAnswer(
    elements.backWord,
    elements.backAlternatives,
    targetText,
    targetAlternatives,
  );
  syncFlashcardPairTypography(state.currentCard);
  renderFlashcardVisuals(state.currentCard);
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
  updateAudioButtons();
  updateEvalButtons();
  updateCardSecondaryAction();
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
  renderFlashcardAnswer(elements.frontWord, elements.frontAlternatives, "Fehler");
  renderFlashcardAnswer(elements.backWord, elements.backAlternatives, "Fehler");
  elements.frontHint.textContent = message;
  renderBackContext(null);
  elements.frontHint.classList.remove("is-summary");
  elements.frontHint.classList.add("is-visible");
  elements.statusMessage.textContent = message;
  elements.flashcard.setAttribute("aria-label", message);
  elements.cardAction.setAttribute("aria-label", message);
  updateAudioButtons();
  updateEvalButtons();
  updateCardSecondaryAction();
  updateOutcomeCounters();
  updateProgressState({ hidden: true });
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
  const showEvalButtons = Boolean(state.currentCard)
    && state.isFlipped
    && !state.summaryMode
    && !state.isComplete;

  for (const evalButton of elements.evalButtons) {
    evalButton.hidden = !showEvalButtons;
    evalButton.disabled = !showEvalButtons;
  }
}

function updateCardSecondaryAction({
  hidden = true,
  label = "",
  action = "",
} = {}) {
  elements.cardSecondaryAction.hidden = hidden;
  elements.cardSecondaryAction.disabled = hidden;
  elements.cardSecondaryAction.dataset.action = hidden ? "" : action;
  elements.cardSecondaryAction.textContent = hidden ? "" : label;
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

  const titleLine = createSummaryTextLine(
    "flashcard__summary-line flashcard__summary-line--title",
    "Runde fertig.",
  );

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

function createSummaryIcon(type) {
  const icon = document.createElement("span");
  icon.className = `flashcard__summary-icon flashcard__summary-icon--${type}`;
  return icon;
}

function getRoundProgressLabel() {
  return `Runde ${state.roundNumber} · ${state.currentIndex + 1} / ${state.cards.length}`;
}

function getRoundSummaryProgressLabel() {
  return `Runde ${state.roundNumber} · abgeschlossen`;
}

function updateProgressFillAnimation(fillElement, value) {
  if (!(fillElement instanceof HTMLElement)) {
    return;
  }

  const nextValue = clamp(value, 0, 100);
  const previousValue = Number.parseFloat(fillElement.dataset.progressValue || "0");
  const progressIncrease = Math.max(0, nextValue - previousValue);
  const gainRatio = nextValue > 0
    ? (progressIncrease / nextValue) * 100
    : 0;

  fillElement.style.setProperty("--progress-value", `${nextValue}%`);
  fillElement.style.setProperty("--progress-gain-ratio", `${clamp(gainRatio, 0, 100)}%`);
  fillElement.dataset.progressValue = String(nextValue);
  fillElement.classList.remove("is-animating-gain");

  if (progressIncrease <= 0.05) {
    return;
  }

  void fillElement.offsetWidth;
  fillElement.classList.add("is-animating-gain");
}

function updateProgressState({ hidden, label = "", value = 0 }) {
  elements.progressShell.setAttribute("aria-hidden", String(hidden));
  elements.progressLabel.textContent = hidden ? "" : label;
  updateProgressFillAnimation(elements.progressFill, value);
}

function renderFlashcardAnswer(wordElement, alternativesElement, primaryText, alternatives = []) {
  hideFlashcardVisuals();
  renderLearningTerm(wordElement, primaryText);

  const visibleAlternatives = Array.isArray(alternatives)
    ? alternatives.filter((answer) => typeof answer === "string" && answer.trim())
    : [];

  const formattedAlternatives = visibleAlternatives.map(formatLearningTermInline);
  const alternativeSeparator = visibleAlternatives.some((answer) => getIrregularVerbForms(answer))
    ? " / "
    : " · ";
  alternativesElement.textContent = formattedAlternatives.length > 0
    ? `(${formattedAlternatives.join(alternativeSeparator)})`
    : "";
  alternativesElement.hidden = visibleAlternatives.length === 0;

  if (visibleAlternatives.length > 0) {
    alternativesElement.setAttribute(
      "aria-label",
      `Weitere gültige Antworten: ${formattedAlternatives.join(", ")}`,
    );
  } else {
    alternativesElement.removeAttribute("aria-label");
  }
}

function hideFlashcardVisuals() {
  elements.backVisual.hidden = true;
  elements.backVisual.removeAttribute("src");
  elements.backVisual.alt = "";
  elements.backVisual.closest(".flashcard__content")?.classList.remove("has-visual");
}

function renderFlashcardVisuals(card) {
  const visual = card?.visual;
  if (!visual?.url) {
    hideFlashcardVisuals();
    return;
  }
  elements.backVisual.hidden = false;
  elements.backVisual.alt = visual.alt || "Lernbild";
  elements.backVisual.src = visual.url;
  elements.backVisual.closest(".flashcard__content")?.classList.add("has-visual");
}

function renderInputVisual(card, visible) {
  const visual = card?.visual;
  const shouldShow = Boolean(visible && visual?.url);
  elements.inputPromptVisual.hidden = !shouldShow;
  elements.inputPromptVisual.alt = shouldShow ? (visual.alt || "Lernbild") : "";
  elements.inputPromptVisual.closest(".input-stage__prompt-pane")?.classList.toggle("has-visual", shouldShow);
  if (shouldShow) {
    elements.inputPromptVisual.src = visual.url;
  } else {
    elements.inputPromptVisual.removeAttribute("src");
  }
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
  elements.backHintShell.hidden = !contextData;

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
    accent.textContent = formatLearningTermInline(contextData.matchText);
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
  return `Runde beendet. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`;
}

function getCompletionStatusMessage() {
  return `Fertig. ${state.knownCount} richtig. ${state.unknownCount} falsch.`;
}

function getRoundSummaryCardLabel() {
  return `Runde fertig. ${state.summaryRoundKnownCount} richtig. ${state.summaryRoundUnknownCount} offen.`;
}

function getCompletionCardLabel() {
  return `Fertig. ${state.knownCount} richtig. ${state.unknownCount} falsch.`;
}

function getCurrentRoundCardStatus() {
  return `Runde ${state.roundNumber}. Karte ${state.currentIndex + 1} von ${state.cards.length}.`;
}

function getCardLabel() {
  if (!state.currentCard) {
    return "Karte nicht verfügbar.";
  }

  if (state.isFlipped) {
    return `${getAccessibleTargetAnswer()}.`;
  }

  return `${formatLearningTermInline(state.currentCard.sourceText)}. Tippen zum Aufdecken.`;
}

function getAccessibleTargetAnswer() {
  const alternatives = state.currentCard?.targetAlternatives || [];

  const targetText = formatLearningTermInline(state.currentCard?.targetText);
  const formattedAlternatives = alternatives.map(formatLearningTermInline);
  return formattedAlternatives.length > 0
    ? `${targetText}. Weitere gültige Antworten: ${formattedAlternatives.join(", ")}`
    : targetText || "Antwort nicht verfügbar";
}
