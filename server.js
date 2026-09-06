const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const fsp = require("fs/promises");
const path = require("path");
const { ImportService } = require("./lib/import-service");
const { SetService } = require("./lib/set-service");
const { TeacherService } = require("./lib/teacher-service");
const { VisualService } = require("./lib/visual-service");

const app = express();
app.set("trust proxy", true);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const ACCESS_PIN_COOLDOWN_STEPS_MS = [
  30 * 1000,
  60 * 1000,
  5 * 60 * 1000,
];
const MAX_TABLET_PIN_FAILURES = 5;
const MAX_TEACHER_LOGIN_FAILURES = 5;
const TEACHER_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const ACCESS_SESSION_COOKIE_NAME = "dino_vocab_access_session";
const TEACHER_SESSION_COOKIE_NAME = "lerndeck_teacher_session";
const ACCESS_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ACCESS_SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Keep classroom devices signed in across lessons and restarts.
const TABLET_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TEACHER_SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TABLET_SET_CARD_COLOR_KEYS = new Set([
  "slate",
  "blue",
  "indigo",
  "teal",
  "sage",
  "amber",
  "rose",
  "violet",
]);
const LEARNING_MODE_KEYS = Object.freeze([
  "practice",
  "write",
  "test",
]);
const DEFAULT_LEARNING_MODE_KEY = "practice";
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const LEGACY_SET_SEED_INDEX_PATH = path.join(ROOT_DIR, "sets", "sets-index.json");
const LEGACY_SET_OWNER_ID = "julius";
const TABLETS_PATH = path.join(DATA_DIR, "tablets.json");
const TABLET_SEED_PATH = path.join(ROOT_DIR, "data", "tablets.seed.json");
const TABLET_SESSIONS_PATH = path.join(DATA_DIR, "tablet-sessions.json");
const TEACHER_SEED_PATH = path.join(ROOT_DIR, "data", "teachers.seed.json");
const HTTPS_KEY_PATH = path.join(ROOT_DIR, "certs", "dev-server-key.pem");
const HTTPS_CERT_PATH = path.join(ROOT_DIR, "certs", "dev-server-cert.pem");
const tabletSessions = loadPersistedTabletSessions();
const accessSessions = new Map();
const teacherLoginFailures = new Map();
const teacherService = new TeacherService({
  dataDir: DATA_DIR,
  seedPath: TEACHER_SEED_PATH,
});
const setService = new SetService({ dataDir: DATA_DIR });
const importService = new ImportService();
const visualService = new VisualService({ dataDir: DATA_DIR, setService });

app.use("/api/teacher/import-draft", express.json({ limit: "18mb" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "lerndeck",
  });
});

app.get("/api/teacher/accounts", async (_request, response) => {
  try {
    response.json({ accounts: await teacherService.listPublicAccounts() });
  } catch (error) {
    console.error("Unable to load teacher accounts:", error);
    response.status(500).json({ error: "Lehrkraftkonten konnten nicht geladen werden." });
  }
});

app.get("/api/teacher/session", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    response.json({
      teacher: await teacherService.getTeacher(sessionResult.teacherId),
      session: {
        teacherId: sessionResult.teacherId,
        expiresAt: new Date(sessionResult.session.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    response.status(500).json({ error: "Lehrkraftkonto konnte nicht geladen werden." });
  }
});

app.post("/api/teacher/session", async (request, response) => {
  const teacherId = typeof request.body?.teacherId === "string" ? request.body.teacherId.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const clientIdentity = getClientIdentity(request);
  const failureIdentity = `${clientIdentity}:${teacherId || "unknown"}`;
  const teacherFailureState = getTeacherLoginFailureState(failureIdentity);

  if (teacherFailureState?.lockedUntil > Date.now()) {
    response.status(429).json({
      error: "Zu viele falsche Versuche. Bitte später erneut versuchen.",
    });
    return;
  }

  if (!teacherId || !password) {
    response.status(400).json({
      error: "Lehrkraft und Passwort sind erforderlich.",
    });
    return;
  }

  try {
    const teacher = await teacherService.authenticate({ teacherId, password });
    teacherLoginFailures.delete(failureIdentity);
    const session = teacherService.createSession(teacher.id);
    setTeacherSessionCookie(request, response, session.token);

    response.json({
      success: true,
      teacher,
      session: {
        teacherId: teacher.id,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    if (error?.status === 401) {
      registerTeacherLoginFailure(failureIdentity);
    }

    response.status(error?.status || 500).json({
      error: error?.status ? error.message : "Anmeldung konnte nicht abgeschlossen werden.",
      code: error?.code || "TEACHER_LOGIN_FAILED",
    });
  }
});

app.delete("/api/teacher/session", (request, response) => {
  teacherService.deleteSession(getTeacherSessionToken(request));
  clearTeacherSessionCookie(request, response);

  response.status(204).end();
});

app.post("/api/teacher/password", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const teacher = await teacherService.changePassword({
      teacherId: sessionResult.teacherId,
      currentPassword: request.body?.currentPassword,
      newPassword: request.body?.newPassword,
    });
    teacherService.deleteSessionsForTeacher(sessionResult.teacherId);
    const session = teacherService.createSession(sessionResult.teacherId);
    setTeacherSessionCookie(request, response, session.token);
    response.json({
      success: true,
      teacher,
      session: {
        teacherId: session.teacherId,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    response.status(error?.status || 500).json({
      error: error?.status ? error.message : "Passwort konnte nicht geändert werden.",
      code: error?.code || "PASSWORD_CHANGE_FAILED",
    });
  }
});

app.get("/api/sets", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const sets = await setService.listOwnedSets(sessionResult.teacherId);

    response.json({
      sets: sets.map((setEntry) => ({
        ...setEntry,
        tablets: getTabletsForSet(store, setEntry?.path),
      })),
      teacher: {
        id: sessionResult.teacherId,
      },
      importConfigured: importService.isConfigured(),
      visualConfigured: visualService.isConfigured(),
    });
  } catch (error) {
    console.error("Unable to load set index:", error);
    response.status(500).json({
      error: "Set-Liste konnte nicht geladen werden.",
    });
  }
});

app.get("/api/teacher/sets/:setId", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const setEntry = await setService.getOwnedSet(sessionResult.teacherId, request.params.setId);
    if (!setEntry) {
      response.status(404).json({ error: "Set nicht gefunden." });
      return;
    }
    response.json({ set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht geladen werden.");
  }
});

app.get("/api/teacher/visual-jobs", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    response.json({ jobs: await visualService.listJobs(sessionResult.teacherId) });
  } catch (error) {
    handleApiError(response, error, "Bildstatus konnte nicht geladen werden.");
  }
});

app.get("/api/teacher/sets/:setId/visual-assets", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    const [assets, jobs] = await Promise.all([
      visualService.listAssets(sessionResult.teacherId, request.params.setId),
      visualService.listJobs(sessionResult.teacherId, { setId: request.params.setId }),
    ]);
    response.json({ assets, jobs });
  } catch (error) {
    handleApiError(response, error, "Bilder konnten nicht geladen werden.");
  }
});

app.post("/api/teacher/sets/:setId/visual-jobs", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    const job = await visualService.startMissingVisuals(sessionResult.teacherId, request.params.setId);
    response.status(202).json({ success: true, job });
  } catch (error) {
    handleApiError(response, error, "Bilderstellung konnte nicht gestartet werden.");
  }
});

app.post("/api/teacher/sets/:setId/visual-regenerations", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    const job = await visualService.startAllVisualRegeneration(
      sessionResult.teacherId,
      request.params.setId,
    );
    response.status(202).json({ success: true, job });
  } catch (error) {
    handleApiError(response, error, "Bilder konnten nicht neu erstellt werden.");
  }
});

app.post("/api/teacher/sets/:setId/cards/:cardId/visual-regenerations", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    const job = await visualService.startCardRegeneration(
      sessionResult.teacherId,
      request.params.setId,
      request.params.cardId,
      request.body?.instruction,
    );
    response.status(202).json({ success: true, job });
  } catch (error) {
    handleApiError(response, error, "Bild konnte nicht neu erstellt werden.");
  }
});

app.put("/api/teacher/sets/:setId/cards/:cardId/visual", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }
  try {
    const result = await visualService.selectAsset(
      sessionResult.teacherId,
      request.params.setId,
      request.params.cardId,
      request.body?.assetId,
    );
    response.json({ success: true, set: result.set });
  } catch (error) {
    handleApiError(response, error, "Bild konnte nicht ausgewählt werden.");
  }
});

app.post("/api/teacher/sets", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const setEntry = await setService.createSet(sessionResult.teacherId, request.body);
    response.status(201).json({ success: true, set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht erstellt werden.");
  }
});

app.post("/api/teacher/set-drafts", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const setEntry = await setService.createDraft(sessionResult.teacherId, request.body);
    response.status(201).json({ success: true, set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Entwurf konnte nicht gespeichert werden.");
  }
});

app.put("/api/teacher/set-drafts/:setId", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const setEntry = await setService.updateDraft(sessionResult.teacherId, request.params.setId, request.body);
    response.json({ success: true, set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Entwurf konnte nicht gespeichert werden.");
  }
});

app.put("/api/teacher/sets/:setId", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const setEntry = await setService.updateSet(sessionResult.teacherId, request.params.setId, request.body);
    response.json({ success: true, set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht gespeichert werden.");
  }
});

app.delete("/api/teacher/sets/:setId", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const deletedSet = await setService.deleteOwnedSet(sessionResult.teacherId, request.params.setId);
    let tabletCleanupComplete = true;
    let tabletsUpdated = 0;

    try {
      tabletsUpdated = await removeSetReferencesFromTablets(deletedSet.path);
    } catch (cleanupError) {
      tabletCleanupComplete = false;
      console.error("Unable to remove deleted set from tablets:", cleanupError);
    }

    response.json({
      success: true,
      set: deletedSet,
      tabletsUpdated,
      tabletCleanupComplete,
    });
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht gelöscht werden.");
  }
});

app.post("/api/teacher/import-draft", async (request, response) => {
  const sessionResult = requireTeacherSession(request);
  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({ error: sessionResult.error });
    return;
  }

  try {
    const result = await importService.createDraft({
      teacherId: sessionResult.teacherId,
      text: request.body?.text,
      instruction: request.body?.instruction,
      files: request.body?.files,
      purpose: request.body?.purpose,
    });
    response.json(result);
  } catch (error) {
    console.error("Unable to create import draft:", error?.code || error);
    handleApiError(response, error, "Material konnte nicht verarbeitet werden.");
  }
});

app.get("/api/set-codes/:shareCode", async (request, response) => {
  try {
    const setEntry = await setService.resolveShareCode(request.params.shareCode);
    if (!setEntry) {
      response.status(404).json({ error: "Set-Code nicht gefunden." });
      return;
    }
    response.json({ set: setEntry });
  } catch (error) {
    handleApiError(response, error, "Set-Code konnte nicht geprüft werden.");
  }
});

app.get("/api/runtime-info", (request, response) => {
  response.json({
    publicOrigin: getPublicOrigin(request),
    localIp: getLocalLanIp(),
  });
});

app.get("/api/access-session", (request, response) => {
  const accessSessionResult = ensureAccessSession(request, response);

  response.json({
    accessSession: serializeAccessSession(accessSessionResult.session),
  });
});

app.use("/api/tablets", serializeMutatingRequests());

app.get("/api/tablet-directory", async (_request, response) => {
  try {
    const store = await readTabletStore();

    response.json({
      tablets: store.tablets
        .map((tablet) => toPublicTablet(tablet))
        .sort(compareTabletLabels),
    });
  } catch (error) {
    console.error("Unable to load tablet directory:", error);
    response.status(500).json({
      error: "Tablet-Verzeichnis konnte nicht geladen werden.",
    });
  }
});

app.get("/api/tablets", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();

    response.json({
      tablets: store.tablets
        .map((tablet) => toSafeTablet(tablet))
        .sort(compareTabletLabels),
    });
  } catch (error) {
    console.error("Unable to load tablet directory:", error);
    response.status(500).json({
      error: "Tablet-Verzeichnis konnte nicht geladen werden.",
    });
  }
});

app.get("/api/tablets/:tabletId", async (request, response) => {
  const sessionResult = requireTabletOrTeacherSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        exists: false,
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    response.json({
      exists: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to read tablet state:", error);
    response.status(500).json({
      error: "Tablet-Status konnte nicht geladen werden.",
    });
  }
});

app.get("/api/tablets/:tabletId/subscriptions", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist nicht mehr gekoppelt. Bitte neu registrieren.",
        tablet: toSafeTablet(tablet),
      });
      return;
    }

    const setEntries = await getAllPublishedSetEntries();

    response.json({
      tablet: toSafeTablet(tablet),
      subscriptions: normalizeTabletSubscriptions(tablet).map((subscription) => {
        const setEntry = setEntries.find((entry) => entry?.path === subscription.setPath);
        const progressEntry = getTabletLearningProgress(tablet, subscription.setPath);

        return {
          setPath: subscription.setPath,
          subscribedAt: subscription.subscribedAt,
          cardColor: subscription.cardColor,
          title: typeof setEntry?.title === "string" && setEntry.title.trim()
            ? setEntry.title.trim()
            : subscription.setPath,
          subject: typeof setEntry?.subject === "string" && setEntry.subject.trim()
            ? setEntry.subject.trim()
            : "",
          description: typeof setEntry?.description === "string" ? setEntry.description.trim() : "",
          cardCount: Number.isFinite(setEntry?.cardCount) ? setEntry.cardCount : null,
          category: typeof setEntry?.category === "string" ? setEntry.category.trim() : "",
          completedRoundCount: Number.isFinite(progressEntry?.completedRoundCount)
            ? progressEntry.completedRoundCount
            : 0,
          averageScorePercent: Number.isFinite(progressEntry?.averageScorePercent)
            ? progressEntry.averageScorePercent
            : null,
          lastRoundPercent: Number.isFinite(progressEntry?.lastRoundPercent)
            ? progressEntry.lastRoundPercent
            : null,
          modeProgress: progressEntry?.modeProgress || createPublicLearningModeProgressMap(),
          id: typeof setEntry?.id === "string" && setEntry.id.trim()
            ? setEntry.id.trim()
            : subscription.setPath,
        };
      }),
    });
  } catch (error) {
    console.error("Unable to load tablet subscriptions:", error);
    response.status(500).json({
      error: "Set-Abos konnten nicht geladen werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/register", async (request, response) => {
  const pin = typeof request.body?.pin === "string" ? request.body.pin.trim() : "";

  if (!isValidPin(pin)) {
    response.status(400).json({
      error: "PIN muss aus 4 bis 8 Ziffern bestehen.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (tablet.registered) {
      response.status(409).json({
        error: "Tablet ist bereits registriert.",
      });
      return;
    }

    const timestamp = new Date().toISOString();
    tablet.pinHash = await bcrypt.hash(pin, 10);
    tablet.pairingId = createPairingId();
    tablet.registered = true;
    tablet.subscriptions = normalizeTabletSubscriptions(tablet);
    tablet.learningProgress = normalizeTabletLearningProgress(tablet);
    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.createdAt = tablet.createdAt || timestamp;
    tablet.updatedAt = timestamp;
    tablet.lastSeenAt = timestamp;
    invalidateTabletSessions(tablet.id);

    await writeTabletStore(store);

    response.json({
      success: true,
      session: createTabletSession(tablet.id),
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to register tablet:", error);
    response.status(500).json({
      error: "Tablet konnte nicht registriert werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/subscriptions", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.body?.setPath);

  if (!setPath) {
    response.status(400).json({
      error: "Gültiger Set-Pfad fehlt.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist noch nicht registriert.",
      });
      return;
    }

    const setEntries = await getAllPublishedSetEntries();
    const setExists = setEntries.some((entry) => entry?.path === setPath);

    if (!setExists) {
      response.status(404).json({
        error: "Set nicht gefunden.",
      });
      return;
    }

    const subscriptions = normalizeTabletSubscriptions(tablet);
    const existingSubscription = subscriptions.find((entry) => entry.setPath === setPath);
    const timestamp = new Date().toISOString();

    if (!existingSubscription) {
      subscriptions.push({
        setPath,
        subscribedAt: timestamp,
      });
    }

    tablet.subscriptions = subscriptions;
    tablet.updatedAt = timestamp;
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to save tablet subscription:", error);
    response.status(500).json({
      error: "Lernset konnte nicht abonniert werden.",
    });
  }
});

app.patch("/api/tablets/:tabletId/subscriptions/card-color", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.body?.setPath);
  const cardColor = normalizeTabletSetCardColor(request.body?.cardColor);

  if (!setPath) {
    response.status(400).json({
      error: "Gültiger Set-Pfad fehlt.",
    });
    return;
  }

  if (!cardColor) {
    response.status(400).json({
      error: "Gültige Kartenfarbe fehlt.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist noch nicht registriert.",
      });
      return;
    }

    const subscriptions = normalizeTabletSubscriptions(tablet);
    const existingIndex = subscriptions.findIndex((entry) => entry.setPath === setPath);

    if (existingIndex === -1) {
      response.status(404).json({
        error: "Lernset ist auf diesem Tablet nicht abonniert.",
      });
      return;
    }

    subscriptions[existingIndex] = {
      ...subscriptions[existingIndex],
      cardColor,
    };

    tablet.subscriptions = subscriptions;
    tablet.updatedAt = new Date().toISOString();
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
      subscription: subscriptions[existingIndex],
    });
  } catch (error) {
    console.error("Unable to save tablet subscription card color:", error);
    response.status(500).json({
      error: "Kartenfarbe konnte nicht gespeichert werden.",
    });
  }
});

app.get("/api/tablets/:tabletId/learning-progress", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.query?.set);

  if (!setPath) {
    response.status(400).json({
      error: "Gültiger Set-Pfad fehlt.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist nicht mehr gekoppelt. Bitte neu registrieren.",
        tablet: toSafeTablet(tablet),
      });
      return;
    }

    const progress = getTabletLearningProgress(tablet, setPath);

    response.json({
      tablet: toSafeTablet(tablet),
      progress,
    });
  } catch (error) {
    console.error("Unable to load learning progress:", error);
    response.status(500).json({
      error: "Lernstand konnte nicht geladen werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/learning-progress/rounds", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.body?.setPath);
  const incrementBy = Number.isFinite(request.body?.incrementBy)
    ? Math.max(1, Math.floor(request.body.incrementBy))
    : 1;
  const modeKey = normalizeLearningModeKey(request.body?.modeKey);
  const lastRoundPercent = normalizeRoundPercent(request.body?.lastRoundPercent);

  if (!setPath) {
    response.status(400).json({
      error: "Gültiger Set-Pfad fehlt.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist nicht mehr gekoppelt. Bitte neu registrieren.",
        tablet: toSafeTablet(tablet),
      });
      return;
    }

    const learningProgress = normalizeTabletLearningProgress(tablet);
    const timestamp = new Date().toISOString();
    const existingIndex = learningProgress.findIndex((entry) => entry.setPath === setPath);
    const previousEntry = existingIndex === -1 ? null : learningProgress[existingIndex];
    const nextModeProgress = cloneLearningModeProgressMap(previousEntry?.modeProgress);
    const previousModeEntry = nextModeProgress[modeKey];
    const nextCompletedRoundCount = previousModeEntry.completedRoundCount + incrementBy;
    const nextTotalScorePercent = getNextLearningModeTotalScorePercent(previousModeEntry, {
      incrementBy,
      lastRoundPercent,
    });

    nextModeProgress[modeKey] = {
      completedRoundCount: nextCompletedRoundCount,
      totalScorePercent: nextTotalScorePercent,
      lastRoundPercent: lastRoundPercent ?? previousModeEntry.lastRoundPercent,
      updatedAt: timestamp,
    };

    const nextEntry = {
      setPath,
      modeProgress: nextModeProgress,
      updatedAt: timestamp,
    };

    if (existingIndex === -1) {
      learningProgress.push(nextEntry);
    } else {
      learningProgress[existingIndex] = nextEntry;
    }

    tablet.learningProgress = learningProgress;
    tablet.updatedAt = timestamp;
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
      progress: getTabletLearningProgress(tablet, setPath),
    });
  } catch (error) {
    console.error("Unable to save round progress:", error);
    response.status(500).json({
      error: "Durchgang konnte nicht gespeichert werden.",
    });
  }
});

app.delete("/api/tablets/:tabletId/subscriptions", async (request, response) => {
  const sessionResult = requireTabletOrTeacherSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.query?.set);

  if (!setPath) {
    response.status(400).json({
      error: "Gültiger Set-Pfad fehlt.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    const subscriptions = normalizeTabletSubscriptions(tablet);
    tablet.subscriptions = subscriptions.filter((entry) => entry.setPath !== setPath);
    tablet.learningProgress = normalizeTabletLearningProgress(tablet)
      .filter((entry) => entry.setPath !== setPath);
    tablet.updatedAt = new Date().toISOString();
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to remove tablet subscription:", error);
    response.status(500).json({
      error: "Abo konnte nicht beendet werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/verify-pin", async (request, response) => {
  const pin = typeof request.body?.pin === "string" ? request.body.pin.trim() : "";
  const accessSessionResult = ensureAccessSession(request, response);
  const accessSession = accessSessionResult.session;
  const now = Date.now();

  if (!pin) {
    response.status(400).json({
      error: "PIN fehlt.",
      accessSession: serializeAccessSession(accessSession, now),
    });
    return;
  }

  if (isAccessSessionCoolingDown(accessSession, now)) {
    response.status(429).json({
      error: buildAccessPinCooldownMessage(accessSession.lockedUntil - now),
      accessSession: serializeAccessSession(accessSession, now),
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
        accessSession: serializeAccessSession(accessSession, now),
      });
      return;
    }

    if (!tablet.registered || !tablet.pinHash) {
      resetAccessSessionState(accessSession, now);
      commitAccessSession(accessSessionResult.token, accessSession, now);
      response.status(409).json({
        error: "Tablet ist noch nicht registriert.",
        accessSession: serializeAccessSession(accessSession, now),
      });
      return;
    }

    if (tablet.lockedAt) {
      response.status(423).json({
        error: "Dieser Tablet-Zugang ist gesperrt. Bitte eine Lehrkraft um Freigabe.",
        tablet: toSafeTablet(tablet),
        accessSession: serializeAccessSession(accessSession, now),
      });
      return;
    }

    if (accessSession.tabletId && accessSession.tabletId !== tablet.id) {
      const boundTablet = findTablet(store, accessSession.tabletId);
      response.status(423).json({
        error: `Du bist gerade auf ${boundTablet?.label || accessSession.tabletId} festgelegt. Erst nach erfolgreichem Login kannst du ein anderes Tablet auswählen.`,
        accessSession: serializeAccessSession(accessSession, now),
      });
      return;
    }

    if (!accessSession.tabletId) {
      accessSession.tabletId = tablet.id;
      accessSession.updatedAt = now;
      commitAccessSession(accessSessionResult.token, accessSession, now);
    }

    const isMatch = await bcrypt.compare(pin, tablet.pinHash);

    if (!isMatch) {
      tablet.failedPinAttempts = Math.max(0, Math.trunc(tablet.failedPinAttempts || 0)) + 1;

      if (tablet.failedPinAttempts >= MAX_TABLET_PIN_FAILURES) {
        tablet.lockedAt = new Date(now).toISOString();
      }

      tablet.updatedAt = new Date(now).toISOString();
      await writeTabletStore(store);
      registerAccessPinFailure(accessSession, now);
      commitAccessSession(accessSessionResult.token, accessSession, now);

      response.status(tablet.lockedAt ? 423 : 429).json({
        error: tablet.lockedAt
          ? "Dieser Tablet-Zugang ist nach zu vielen falschen Versuchen gesperrt. Bitte eine Lehrkraft um Freigabe."
          : buildAccessPinCooldownMessage(accessSession.lockedUntil - now, { includeWrongPin: true }),
        tablet: toSafeTablet(tablet),
        accessSession: serializeAccessSession(accessSession, now),
      });
      return;
    }

    resetAccessSessionState(accessSession, now);
    commitAccessSession(accessSessionResult.token, accessSession, now);
    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.lastSeenAt = new Date().toISOString();
    tablet.updatedAt = tablet.lastSeenAt;
    invalidateTabletSessions(tablet.id);
    await writeTabletStore(store);

    response.json({
      success: true,
      session: createTabletSession(tablet.id),
      tablet: toSafeTablet(tablet),
      accessSession: serializeAccessSession(accessSession, now),
    });
  } catch (error) {
    console.error("Unable to verify tablet pin:", error);
    response.status(500).json({
      error: "PIN konnte nicht geprüft werden.",
      accessSession: serializeAccessSession(accessSession, now),
    });
  }
});

app.post("/api/tablets/:tabletId/reset-access-session", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    clearAccessSessionsForTablet(tablet.id);
    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.updatedAt = new Date().toISOString();
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to reset access session:", error);
    response.status(500).json({
      error: "Timeout konnte nicht aufgehoben werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/reset-pin", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const pin = typeof request.body?.pin === "string" ? request.body.pin.trim() : "";

  if (!isValidPin(pin)) {
    response.status(400).json({
      error: "PIN muss aus 4 bis 8 Ziffern bestehen.",
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    if (!tablet.registered) {
      response.status(409).json({
        error: "Tablet ist nicht gekoppelt.",
      });
      return;
    }

    const timestamp = new Date().toISOString();
    tablet.pinHash = await bcrypt.hash(pin, 10);
    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.updatedAt = timestamp;
    invalidateTabletSessions(tablet.id);
    clearAccessSessionsForTablet(tablet.id);
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to reset tablet pin:", error);
    response.status(500).json({
      error: "PIN konnte nicht zurückgesetzt werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/decouple", async (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
      });
      return;
    }

    tablet.pinHash = null;
    tablet.pairingId = null;
    tablet.registered = false;
    tablet.subscriptions = [];
    tablet.learningProgress = [];
    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.createdAt = null;
    tablet.updatedAt = null;
    tablet.lastSeenAt = null;
    invalidateTabletSessions(tablet.id);
    clearAccessSessionsForTablet(tablet.id);
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to decouple tablet:", error);
    response.status(500).json({
      error: "Kopplung konnte nicht gelöscht werden.",
    });
  }
});

app.get("/teacher", (_request, response) => {
  setPwaControlFileCacheHeaders(response);
  response.sendFile(path.join(ROOT_DIR, "teacher.html"));
});

app.get("/media/visuals/:assetFile", async (request, response, next) => {
  const match = String(request.params.assetFile || "").match(/^([a-z0-9][a-z0-9_-]{0,127})\.webp$/i);
  if (!match) {
    next();
    return;
  }
  try {
    const assetPath = await visualService.getAssetFile(match[1]);
    if (!assetPath) {
      response.status(404).end();
      return;
    }
    response.set("Cache-Control", "public, max-age=31536000, immutable");
    response.type("image/webp").sendFile(assetPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      response.status(404).end();
      return;
    }
    console.error("Unable to serve visual asset:", error);
    response.status(500).end();
  }
});

app.get("/sets/user/:setId.json", async (request, response) => {
  try {
    const setEntry = await setService.findPublishedSetById(request.params.setId);
    if (!setEntry) {
      response.status(404).json({ error: "Set nicht gefunden." });
      return;
    }

    response.set("Cache-Control", "no-store");
    response.json(setService.toSetDocument(setEntry));
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht geladen werden.");
  }
});

app.get("/sets/:setFile", async (request, response, next) => {
  const setPath = normalizeSetPath(`sets/${request.params.setFile}`);
  if (!setPath) {
    next();
    return;
  }

  try {
    const setEntry = await setService.findPublishedSetByPath(setPath);
    if (!setEntry) {
      next();
      return;
    }

    response.set("Cache-Control", "no-store");
    response.json(setService.toSetDocument(setEntry));
  } catch (error) {
    handleApiError(response, error, "Set konnte nicht geladen werden.");
  }
});

const PUBLIC_ROOT_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/teacher.html", "teacher.html"],
  ["/teacher.css", "teacher.css"],
  ["/teacher.js", "teacher.js"],
  ["/pwa-splash.css", "pwa-splash.css"],
  ["/ui-motion.css", "ui-motion.css"],
  ["/ui-motion.js", "ui-motion.js"],
  ["/irregular-verbs.js", "irregular-verbs.js"],
  ["/manifest.webmanifest", "manifest.webmanifest"],
  ["/teacher.webmanifest", "teacher.webmanifest"],
  ["/pwa.js", "pwa.js"],
  ["/sw.js", "sw.js"],
  ["/noise.svg", "noise.svg"],
  ["/code.html", "code.html"],
  ["/food-basics-01.json", "food-basics-01.json"],
  ["/example-set-improved.json", "example-set-improved.json"],
]);

const PWA_CONTROL_FILE_PATHS = new Set([
  "/",
  "/index.html",
  "/teacher.html",
  "/manifest.webmanifest",
  "/teacher.webmanifest",
  "/pwa.js",
  "/sw.js",
]);

function setPwaControlFileCacheHeaders(response) {
  response.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.set("Pragma", "no-cache");
  response.set("Expires", "0");
}

app.get([...PUBLIC_ROOT_FILES.keys()], (request, response) => {
  if (PWA_CONTROL_FILE_PATHS.has(request.path)) {
    setPwaControlFileCacheHeaders(response);
  }
  response.sendFile(path.join(ROOT_DIR, PUBLIC_ROOT_FILES.get(request.path)));
});

for (const publicDirectory of ["assets", "audio", "icons", "sets"]) {
  app.use(`/${publicDirectory}`, express.static(path.join(ROOT_DIR, publicDirectory), {
    dotfiles: "deny",
    index: false,
  }));
}

const shouldStartLocalHttps = !process.env.RENDER && fs.existsSync(HTTPS_KEY_PATH) && fs.existsSync(HTTPS_CERT_PATH);

async function startServers() {
  await visualService.recoverInterruptedJobs();
  const migration = await migrateLegacySetsToJulius();
  if (migration.added > 0) {
    console.log(`${migration.added} vorhandene Lernsets Julius zugeordnet.`);
  }

  http.createServer(app).listen(PORT, HOST, () => {
    console.log(`Lerndeck listening on http://${HOST}:${PORT}`);
  });

  if (shouldStartLocalHttps) {
    try {
      const key = fs.readFileSync(HTTPS_KEY_PATH);
      const cert = fs.readFileSync(HTTPS_CERT_PATH);

      https.createServer({ key, cert }, app).listen(HTTPS_PORT, HOST, () => {
        console.log(`Lerndeck listening on https://${HOST}:${HTTPS_PORT}`);
      });
    } catch (error) {
      console.error("Unable to start HTTPS server:", error);
    }
  } else {
    console.log("HTTPS disabled: Render handles TLS in production, local dev certs are optional.");
  }
}

startServers().catch((error) => {
  console.error("Lerndeck konnte nicht gestartet werden:", error);
  process.exitCode = 1;
});

async function readJsonFile(filePath, fallbackValue) {
  try {
    const rawValue = await fsp.readFile(filePath, "utf8");
    return JSON.parse(rawValue);
  } catch (error) {
    if (error && error.code === "ENOENT" && fallbackValue !== undefined) {
      return fallbackValue;
    }

    throw error;
  }
}

async function readTabletStore() {
  let store;

  try {
    store = await readJsonFile(TABLETS_PATH);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    store = await readJsonFile(TABLET_SEED_PATH, { tablets: [] });
    await writeTabletStore(store);
  }

  return {
    tablets: Array.isArray(store?.tablets)
      ? store.tablets.map((tablet) => ({
          ...tablet,
          subscriptions: normalizeTabletSubscriptions(tablet),
          learningProgress: normalizeTabletLearningProgress(tablet),
          pairingId: normalizePairingId(tablet),
        }))
      : [],
  };
}

async function getAllPublishedSetEntries() {
  return setService.listPublishedEntries();
}

async function migrateLegacySetsToJulius() {
  const index = await readJsonFile(LEGACY_SET_SEED_INDEX_PATH, { sets: [] });
  const seedSets = await Promise.all((Array.isArray(index?.sets) ? index.sets : []).map(async (entry) => {
    const setPath = normalizeSetPath(entry?.path);
    if (!setPath) {
      throw new Error(`Ungültiger historischer Set-Pfad: ${entry?.path || "(leer)"}`);
    }

    const document = await readJsonFile(path.join(ROOT_DIR, setPath));
    const setMeta = document?.set && typeof document.set === "object" ? document.set : {};
    const languages = setMeta.languages && typeof setMeta.languages === "object" ? setMeta.languages : {};
    const labels = setMeta.labels && typeof setMeta.labels === "object" ? setMeta.labels : {};
    const id = typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : setMeta.id;

    return {
      id,
      path: setPath,
      title: entry?.title || setMeta.title,
      subject: resolveSetSubject(entry?.subject, setMeta.subject, languages),
      description: entry?.description || setMeta.description,
      sourceLanguage: languages.source,
      targetLanguage: languages.target,
      sourceLabel: labels.source || getLanguageLabel(languages.source, "Begriff"),
      targetLabel: labels.target || getLanguageLabel(languages.target, "Übersetzung oder Definition"),
      revision: setMeta.revision,
      createdAt: setMeta.createdAt,
      updatedAt: setMeta.updatedAt,
      publishedAt: setMeta.createdAt,
      cards: (Array.isArray(document?.cards) ? document.cards : []).map((card) => ({
        id: card?.id,
        front: card?.source?.text,
        back: card?.target?.text,
        acceptedAnswers: card?.acceptedAnswers,
        presentation: {
          examples: card?.examples,
          hintData: card?.hintData,
          meta: card?.meta,
          audio: card?.audio,
        },
      })),
    };
  }));

  return setService.ensureOwnedSeedSets(LEGACY_SET_OWNER_ID, seedSets);
}

function resolveSetSubject(indexSubject, setSubject, languages) {
  const explicitSubject = typeof indexSubject === "string" && indexSubject.trim()
    ? indexSubject.trim()
    : (typeof setSubject === "string" && setSubject.trim() ? setSubject.trim() : "");

  if (explicitSubject) {
    return explicitSubject;
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

function getLanguageLabel(languageCode, fallback) {
  const labels = {
    de: "Deutsch",
    en: "Englisch",
    fr: "Französisch",
    es: "Spanisch",
    it: "Italienisch",
  };
  const normalizedCode = typeof languageCode === "string" ? languageCode.trim().toLowerCase() : "";
  return labels[normalizedCode] || fallback;
}

async function writeTabletStore(store) {
  await fsp.mkdir(path.dirname(TABLETS_PATH), { recursive: true });
  const tempPath = `${TABLETS_PATH}.${process.pid}.${Date.now()}.${createPairingId()}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(store, null, 2));
  await fsp.rename(tempPath, TABLETS_PATH);
}

function findTablet(store, tabletId) {
  if (!Array.isArray(store?.tablets)) {
    return null;
  }

  return store.tablets.find((entry) => entry?.id === tabletId) || null;
}

function toSafeTablet(tablet) {
  return {
    id: tablet.id,
    label: tablet.label,
    registered: Boolean(tablet.registered),
    pairingId: normalizePairingId(tablet),
    isCoupled: Boolean(tablet.registered),
    isLocked: Boolean(tablet.lockedAt),
    failedPinAttempts: Math.max(0, Math.trunc(tablet.failedPinAttempts || 0)),
    subscriptions: normalizeTabletSubscriptions(tablet),
    progressSetCount: normalizeTabletLearningProgress(tablet).length,
    accessSession: getTabletAccessSessionSnapshot(tablet.id),
    createdAt: tablet.createdAt || null,
    updatedAt: tablet.updatedAt || null,
    lastSeenAt: tablet.lastSeenAt || null,
  };
}

function getClientIdentity(request) {
  const cloudflareAddress = typeof request.get === "function"
    ? request.get("cf-connecting-ip")
    : request.headers?.["cf-connecting-ip"];

  return (typeof cloudflareAddress === "string" && cloudflareAddress.trim())
    ? cloudflareAddress.trim()
    : (request.socket?.remoteAddress || "unknown");
}

function getTeacherLoginFailureState(clientIdentity, now = Date.now()) {
  const state = teacherLoginFailures.get(clientIdentity);

  if (!state) {
    return null;
  }

  if (state.lockedUntil && state.lockedUntil <= now) {
    teacherLoginFailures.delete(clientIdentity);
    return null;
  }

  return state;
}

function registerTeacherLoginFailure(clientIdentity, now = Date.now()) {
  const currentState = getTeacherLoginFailureState(clientIdentity, now) || {
    failureCount: 0,
    lockedUntil: 0,
  };
  currentState.failureCount += 1;

  if (currentState.failureCount >= MAX_TEACHER_LOGIN_FAILURES) {
    currentState.lockedUntil = now + TEACHER_LOGIN_LOCKOUT_MS;
  }

  teacherLoginFailures.set(clientIdentity, currentState);
  return currentState;
}

function toPublicTablet(tablet) {
  return {
    id: tablet.id,
    label: tablet.label,
    registered: Boolean(tablet.registered),
    isCoupled: Boolean(tablet.registered),
    accessSession: getTabletAccessSessionSnapshot(tablet.id),
  };
}

function compareTabletLabels(left, right) {
  const leftLabel = typeof left?.label === "string" && left.label.trim()
    ? left.label.trim()
    : left?.id || "";
  const rightLabel = typeof right?.label === "string" && right.label.trim()
    ? right.label.trim()
    : right?.id || "";

  return leftLabel.localeCompare(rightLabel, "de", {
    numeric: true,
    sensitivity: "base",
  });
}

function isValidPin(pin) {
  return /^[0-9]{4,8}$/.test(pin);
}

function normalizeSetPath(value) {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (
    !rawValue
    || !rawValue.endsWith(".json")
    || rawValue.startsWith("/")
    || rawValue.includes("\\")
    || rawValue.includes("?")
    || rawValue.includes("#")
    || !rawValue.startsWith("sets/")
  ) {
    return "";
  }

  const parts = rawValue.split("/");
  return parts.some((segment) => segment === "" || segment === "." || segment === "..")
    ? ""
    : rawValue;
}

function normalizePairingId(tablet) {
  if (typeof tablet?.pairingId === "string" && tablet.pairingId.trim()) {
    return tablet.pairingId.trim();
  }

  if (!tablet?.registered) {
    return null;
  }

  const legacySeed = typeof tablet?.createdAt === "string" && tablet.createdAt.trim()
    ? tablet.createdAt.trim()
    : "registered";
  return `legacy:${tablet.id}:${legacySeed}`;
}

function ensureAccessSession(request, response) {
  purgeExpiredSessions(accessSessions);
  const existingToken = readCookie(request, ACCESS_SESSION_COOKIE_NAME);
  const now = Date.now();
  let token = existingToken;
  let session = accessSessions.get(existingToken);

  if (!token || !session) {
    token = createSessionToken();
    session = createEmptyAccessSession(now);
  }

  session.expiresAt = now + ACCESS_SESSION_TTL_MS;
  accessSessions.set(token, session);
  response.cookie(ACCESS_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.secure,
    path: "/",
    maxAge: ACCESS_SESSION_COOKIE_MAX_AGE_MS,
  });

  return {
    token,
    session,
  };
}

function readCookie(request, cookieName) {
  const headerValue = typeof request.headers?.cookie === "string" ? request.headers.cookie : "";

  if (!headerValue) {
    return "";
  }

  const segments = headerValue.split(";");

  for (const segment of segments) {
    const [rawName, ...rawValueParts] = segment.split("=");

    if (typeof rawName !== "string" || rawName.trim() !== cookieName) {
      continue;
    }

    try {
      return decodeURIComponent(rawValueParts.join("=").trim());
    } catch (_error) {
      return "";
    }
  }

  return "";
}

function getTeacherSessionToken(request) {
  return readCookie(request, TEACHER_SESSION_COOKIE_NAME) || getBearerToken(request);
}

function setTeacherSessionCookie(request, response, token) {
  response.cookie(TEACHER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.secure,
    path: "/",
    maxAge: TEACHER_SESSION_COOKIE_MAX_AGE_MS,
  });
}

function clearTeacherSessionCookie(request, response) {
  response.clearCookie(TEACHER_SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.secure,
    path: "/",
  });
}

function serializeMutatingRequests() {
  let queueTail = Promise.resolve();

  return (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }

    const previousTurn = queueTail;
    let releaseTurn;
    queueTail = new Promise((resolve) => {
      releaseTurn = resolve;
    });

    previousTurn.then(() => {
      let released = false;
      const release = () => {
        if (released) {
          return;
        }
        released = true;
        releaseTurn();
      };

      response.once("finish", release);
      response.once("close", release);
      next();
    });
  };
}

function handleApiError(response, error, fallbackMessage) {
  const status = Number.isFinite(error?.status) ? error.status : 500;
  if (status >= 500) {
    console.error(fallbackMessage, error);
  }
  response.status(status).json({
    error: (status < 500 || error?.expose) && error?.message ? error.message : fallbackMessage,
    code: error?.code || "INTERNAL_ERROR",
  });
}

function createEmptyAccessSession(now = Date.now()) {
  return {
    tabletId: "",
    failureCount: 0,
    lockedUntil: 0,
    updatedAt: now,
    expiresAt: now + ACCESS_SESSION_TTL_MS,
  };
}

function commitAccessSession(token, session, now = Date.now()) {
  session.updatedAt = now;
  session.expiresAt = now + ACCESS_SESSION_TTL_MS;
  accessSessions.set(token, session);
}

function registerAccessPinFailure(session, now = Date.now()) {
  session.failureCount = Math.max(0, Math.trunc(session.failureCount || 0)) + 1;
  session.lockedUntil = now + getAccessPinCooldownDuration(session.failureCount);
  session.updatedAt = now;
  return session;
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

function resetAccessSessionState(session, now = Date.now()) {
  session.tabletId = "";
  session.failureCount = 0;
  session.lockedUntil = 0;
  session.updatedAt = now;
  return session;
}

function isAccessSessionCoolingDown(session, now = Date.now()) {
  return Number.isFinite(session?.lockedUntil) && session.lockedUntil > now;
}

function serializeAccessSession(session, now = Date.now()) {
  if (!session || !session.tabletId) {
    return {
      tabletId: "",
      failureCount: 0,
      isBound: false,
      isCoolingDown: false,
      lockedUntil: null,
      remainingMs: 0,
    };
  }

  const lockedUntil = Number.isFinite(session.lockedUntil) && session.lockedUntil > now
    ? session.lockedUntil
    : 0;

  return {
    tabletId: session.tabletId,
    failureCount: Math.max(0, Math.trunc(session.failureCount || 0)),
    isBound: true,
    isCoolingDown: lockedUntil > now,
    lockedUntil: lockedUntil > now ? new Date(lockedUntil).toISOString() : null,
    remainingMs: lockedUntil > now ? lockedUntil - now : 0,
  };
}

function clearAccessSessionsForTablet(tabletId) {
  for (const [token, session] of accessSessions.entries()) {
    if (session?.tabletId === tabletId) {
      accessSessions.delete(token);
    }
  }
}

function getTabletAccessSessionSnapshot(tabletId, now = Date.now()) {
  purgeExpiredSessions(accessSessions);
  let activeSession = null;

  for (const session of accessSessions.values()) {
    if (session?.tabletId !== tabletId) {
      continue;
    }

    if (!activeSession) {
      activeSession = session;
      continue;
    }

    const activeLockedUntil = Number.isFinite(activeSession.lockedUntil) ? activeSession.lockedUntil : 0;
    const nextLockedUntil = Number.isFinite(session.lockedUntil) ? session.lockedUntil : 0;

    if (nextLockedUntil > activeLockedUntil || (session.updatedAt || 0) > (activeSession.updatedAt || 0)) {
      activeSession = session;
    }
  }

  return activeSession ? serializeAccessSession(activeSession, now) : null;
}

function formatRemainingCooldown(remainingMs) {
  const safeRemainingMs = Math.max(0, Math.ceil(remainingMs));

  if (safeRemainingMs >= 60 * 1000) {
    const minutes = Math.ceil(safeRemainingMs / (60 * 1000));
    return `${minutes} Minute${minutes === 1 ? "" : "n"}`;
  }

  const seconds = Math.max(1, Math.ceil(safeRemainingMs / 1000));
  return `${seconds} Sekunde${seconds === 1 ? "" : "n"}`;
}

function buildAccessPinCooldownMessage(remainingMs, { includeWrongPin = false } = {}) {
  const prefix = includeWrongPin ? "PIN stimmt nicht." : "Bitte warte";
  return `${prefix} ${formatRemainingCooldown(remainingMs)} und versuche es dann erneut.`;
}

function createPairingId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString("hex");
}

function createSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

function createTabletSession(tabletId) {
  purgeExpiredSessions(tabletSessions);
  const expiresAt = Date.now() + TABLET_SESSION_TTL_MS;
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);

  tabletSessions.set(tokenHash, {
    tabletId,
    expiresAt,
  });
  persistTabletSessions();

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function purgeExpiredSessions(sessionStore) {
  const now = Date.now();
  let removedCount = 0;

  for (const [token, session] of sessionStore.entries()) {
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      sessionStore.delete(token);
      removedCount += 1;
    }
  }

  return removedCount;
}

function invalidateTabletSessions(tabletId) {
  let hasChanges = false;

  for (const [tokenHash, session] of tabletSessions.entries()) {
    if (session?.tabletId === tabletId) {
      tabletSessions.delete(tokenHash);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    persistTabletSessions();
  }
}

function getBearerToken(request) {
  const authorizationHeader = typeof request.get === "function"
    ? request.get("authorization")
    : request.headers?.authorization;
  const match = typeof authorizationHeader === "string"
    ? authorizationHeader.match(/^Bearer\s+(.+)$/i)
    : null;

  return match?.[1]?.trim() || "";
}

function requireTabletSession(request, tabletId) {
  const expiredSessionCount = purgeExpiredSessions(tabletSessions);

  if (expiredSessionCount > 0) {
    persistTabletSessions();
  }

  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Bitte zuerst mit PIN anmelden.",
    };
  }

  const session = tabletSessions.get(hashSessionToken(token));

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Sitzung abgelaufen. Bitte erneut mit PIN anmelden.",
    };
  }

  if (session.tabletId !== tabletId) {
    return {
      ok: false,
      status: 403,
      error: "Diese Sitzung passt nicht zu diesem Tablet.",
    };
  }

  return {
    ok: true,
    status: 200,
    token,
    session,
  };
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function loadPersistedTabletSessions() {
  try {
    const rawValue = fs.readFileSync(TABLET_SESSIONS_PATH, "utf8");
    const parsed = JSON.parse(rawValue);
    const now = Date.now();
    const entries = Array.isArray(parsed?.sessions) ? parsed.sessions : [];

    return new Map(entries
      .filter((entry) => (
        typeof entry?.tokenHash === "string"
        && /^[a-f0-9]{64}$/.test(entry.tokenHash)
        && typeof entry?.tabletId === "string"
        && entry.tabletId.trim()
        && Number.isFinite(entry?.expiresAt)
        && entry.expiresAt > now
      ))
      .map((entry) => [entry.tokenHash, {
        tabletId: entry.tabletId.trim(),
        expiresAt: entry.expiresAt,
      }]));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Unable to load persisted tablet sessions:", error);
    }

    return new Map();
  }
}

function persistTabletSessions() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempPath = `${TABLET_SESSIONS_PATH}.${process.pid}.tmp`;
    const payload = {
      sessions: [...tabletSessions.entries()].map(([tokenHash, session]) => ({
        tokenHash,
        tabletId: session.tabletId,
        expiresAt: session.expiresAt,
      })),
    };

    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    fs.renameSync(tempPath, TABLET_SESSIONS_PATH);
  } catch (error) {
    console.error("Unable to persist tablet sessions:", error);
    throw error;
  }
}

function requireTeacherSession(request) {
  return teacherService.requireSession(getTeacherSessionToken(request));
}

function requireTabletOrTeacherSession(request, tabletId) {
  const teacherSession = requireTeacherSession(request);

  if (teacherSession.ok) {
    return teacherSession;
  }

  return requireTabletSession(request, tabletId);
}

function normalizeTabletSubscriptions(tablet) {
  if (!Array.isArray(tablet?.subscriptions)) {
    return [];
  }

  return tablet.subscriptions
    .map((entry) => {
      const setPath = normalizeSetPath(entry?.setPath);

      if (!setPath) {
        return null;
      }

      return {
        setPath,
        subscribedAt: typeof entry?.subscribedAt === "string" && entry.subscribedAt.trim()
          ? entry.subscribedAt.trim()
          : null,
        cardColor: normalizeTabletSetCardColor(entry?.cardColor),
      };
    })
    .filter(Boolean);
}

function normalizeTabletSetCardColor(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return TABLET_SET_CARD_COLOR_KEYS.has(normalizedValue) ? normalizedValue : null;
}

function normalizeRoundPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(Math.min(100, Math.max(0, value)));
}

function normalizeLearningModeKey(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return LEARNING_MODE_KEYS.includes(normalizedValue) ? normalizedValue : DEFAULT_LEARNING_MODE_KEY;
}

function createEmptyLearningModeProgressEntry() {
  return {
    completedRoundCount: 0,
    totalScorePercent: null,
    lastRoundPercent: null,
    updatedAt: null,
  };
}

function createEmptyLearningModeProgressMap() {
  return Object.fromEntries(LEARNING_MODE_KEYS.map((modeKey) => [modeKey, createEmptyLearningModeProgressEntry()]));
}

function cloneLearningModeProgressMap(value) {
  const normalized = normalizeLearningModeProgressMap(value);
  return Object.fromEntries(LEARNING_MODE_KEYS.map((modeKey) => [modeKey, {
    ...normalized[modeKey],
  }]));
}

function normalizeLearningModeTotalScorePercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function normalizeLearningModeProgressEntry(value) {
  const completedRoundCount = Number.isFinite(value?.completedRoundCount)
    ? Math.max(0, Math.floor(value.completedRoundCount))
    : 0;
  const totalScorePercent = normalizeLearningModeTotalScorePercent(
    value?.totalScorePercent ?? value?.scoreTotalPercent,
  );
  const derivedAverageScorePercent = Number.isFinite(value?.averageScorePercent)
    ? Math.max(0, Math.round(value.averageScorePercent))
    : null;
  const lastRoundPercent = normalizeRoundPercent(value?.lastRoundPercent);

  return {
    completedRoundCount,
    totalScorePercent: totalScorePercent ?? (
      derivedAverageScorePercent !== null && completedRoundCount > 0
        ? derivedAverageScorePercent * completedRoundCount
        : null
    ),
    lastRoundPercent,
    updatedAt: typeof value?.updatedAt === "string" && value.updatedAt.trim()
      ? value.updatedAt.trim()
      : null,
  };
}

function buildLegacyPracticeModeProgressEntry(value) {
  const completedRoundCount = Number.isFinite(value?.completedRoundCount)
    ? Math.max(0, Math.floor(value.completedRoundCount))
    : 0;
  const lastRoundPercent = normalizeRoundPercent(value?.lastRoundPercent);
  const explicitAverageScorePercent = Number.isFinite(value?.averageScorePercent)
    ? Math.max(0, Math.round(value.averageScorePercent))
    : null;
  const totalScorePercent = normalizeLearningModeTotalScorePercent(value?.totalScorePercent);

  return {
    completedRoundCount,
    totalScorePercent: totalScorePercent ?? (
      explicitAverageScorePercent !== null && completedRoundCount > 0
        ? explicitAverageScorePercent * completedRoundCount
        : (completedRoundCount === 1 && lastRoundPercent !== null ? lastRoundPercent : null)
    ),
    lastRoundPercent,
    updatedAt: typeof value?.updatedAt === "string" && value.updatedAt.trim()
      ? value.updatedAt.trim()
      : null,
  };
}

function hasLearningModeProgressData(value) {
  return Boolean(
    value
    && (
      value.completedRoundCount > 0
      || value.totalScorePercent !== null
      || value.lastRoundPercent !== null
      || value.updatedAt
    )
  );
}

function normalizeLearningModeProgressMap(value, legacyValue = null) {
  const nextProgress = createEmptyLearningModeProgressMap();

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const modeKey of LEARNING_MODE_KEYS) {
      nextProgress[modeKey] = normalizeLearningModeProgressEntry(value[modeKey]);
    }
  }

  const legacyPracticeProgress = buildLegacyPracticeModeProgressEntry(legacyValue);
  if (!hasLearningModeProgressData(nextProgress[DEFAULT_LEARNING_MODE_KEY]) && hasLearningModeProgressData(legacyPracticeProgress)) {
    nextProgress[DEFAULT_LEARNING_MODE_KEY] = legacyPracticeProgress;
  }

  return nextProgress;
}

function getAverageLearningModeScorePercent(value) {
  if (!value || value.completedRoundCount < 1 || !Number.isFinite(value.totalScorePercent)) {
    return null;
  }

  return Math.round(value.totalScorePercent / value.completedRoundCount);
}

function createPublicLearningModeProgressMap(value, legacyValue = null) {
  const normalizedProgress = normalizeLearningModeProgressMap(value, legacyValue);

  return Object.fromEntries(LEARNING_MODE_KEYS.map((modeKey) => {
    const progressEntry = normalizedProgress[modeKey];
    return [modeKey, {
      completedRoundCount: progressEntry.completedRoundCount,
      averageScorePercent: getAverageLearningModeScorePercent(progressEntry),
      lastRoundPercent: progressEntry.lastRoundPercent,
      updatedAt: progressEntry.updatedAt,
    }];
  }));
}

function getNextLearningModeTotalScorePercent(previousEntry, {
  incrementBy = 1,
  lastRoundPercent = null,
} = {}) {
  if (Number.isFinite(previousEntry?.totalScorePercent)) {
    return previousEntry.totalScorePercent + (
      lastRoundPercent !== null ? lastRoundPercent * incrementBy : 0
    );
  }

  if ((previousEntry?.completedRoundCount || 0) > 0) {
    return null;
  }

  return lastRoundPercent !== null ? lastRoundPercent * incrementBy : null;
}

function normalizeTabletLearningProgress(tablet) {
  if (!Array.isArray(tablet?.learningProgress)) {
    return [];
  }

  return tablet.learningProgress
    .map((entry) => {
      const setPath = normalizeSetPath(entry?.setPath);

      if (!setPath) {
        return null;
      }

      return {
        setPath,
        modeProgress: normalizeLearningModeProgressMap(entry?.modeProgress, entry),
        updatedAt: typeof entry?.updatedAt === "string" && entry.updatedAt.trim()
          ? entry.updatedAt.trim()
          : null,
      };
    })
    .filter(Boolean);
}

function getTabletLearningProgress(tablet, setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);
  const entry = normalizeTabletLearningProgress(tablet).find((progress) => progress.setPath === normalizedSetPath);
  const modeProgress = createPublicLearningModeProgressMap(entry?.modeProgress, entry);
  const practiceProgress = modeProgress[DEFAULT_LEARNING_MODE_KEY];

  return {
    setPath: normalizedSetPath,
    completedRoundCount: practiceProgress?.completedRoundCount || 0,
    averageScorePercent: practiceProgress?.averageScorePercent ?? null,
    lastRoundPercent: practiceProgress?.lastRoundPercent ?? null,
    modeProgress,
    updatedAt: entry?.updatedAt || null,
  };
}

function getTabletsForSet(store, setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);

  if (!normalizedSetPath || !Array.isArray(store?.tablets)) {
    return [];
  }

  return store.tablets
    .filter((tablet) =>
      normalizeTabletSubscriptions(tablet).some((entry) => entry.setPath === normalizedSetPath))
    .map((tablet) => {
      const subscription = normalizeTabletSubscriptions(tablet)
        .find((entry) => entry.setPath === normalizedSetPath);

      return {
        id: tablet.id,
        label: tablet.label,
        subscribedAt: subscription?.subscribedAt || null,
      };
    });
}

async function removeSetReferencesFromTablets(setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);
  if (!normalizedSetPath) {
    return 0;
  }

  const store = await readTabletStore();
  let tabletsUpdated = 0;

  for (const tablet of store.tablets) {
    const subscriptions = normalizeTabletSubscriptions(tablet);
    const learningProgress = normalizeTabletLearningProgress(tablet);
    const nextSubscriptions = subscriptions.filter((entry) => entry.setPath !== normalizedSetPath);
    const nextLearningProgress = learningProgress.filter((entry) => entry.setPath !== normalizedSetPath);

    if (
      nextSubscriptions.length === subscriptions.length
      && nextLearningProgress.length === learningProgress.length
    ) {
      continue;
    }

    tablet.subscriptions = nextSubscriptions;
    tablet.learningProgress = nextLearningProgress;
    tablet.updatedAt = new Date().toISOString();
    tabletsUpdated += 1;
  }

  if (tabletsUpdated > 0) {
    await writeTabletStore(store);
  }

  return tabletsUpdated;
}

function getPublicOrigin(request) {
  const explicitBaseUrl = typeof process.env.PUBLIC_BASE_URL === "string"
    ? process.env.PUBLIC_BASE_URL.trim()
    : "";

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }

  const protocol = request.protocol || "http";
  const hostHeader = request.get("host") || `localhost:${PORT}`;

  try {
    const requestUrl = new URL(`${protocol}://${hostHeader}`);

    if (!isLoopbackHostname(requestUrl.hostname)) {
      return requestUrl.origin;
    }

    const localIp = getLocalLanIp();

    if (!localIp) {
      return requestUrl.origin;
    }

    const nextUrl = new URL(requestUrl.origin);
    nextUrl.hostname = localIp;
    return nextUrl.origin;
  } catch (_error) {
    return `${protocol}://${hostHeader}`;
  }
}

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getLocalLanIp() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      if (isPrivateIPv4(entry.address)) {
        return entry.address;
      }
    }
  }

  return "";
}

function isPrivateIPv4(address) {
  return (
    address.startsWith("10.")
    || address.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}
