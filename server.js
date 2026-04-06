const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const fsp = require("fs/promises");
const path = require("path");

const app = express();
app.set("trust proxy", true);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const MAX_PIN_FAILURES = 3;
const TABLET_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TEACHER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const SET_INDEX_PATH = path.join(ROOT_DIR, "sets", "sets-index.json");
const TABLETS_PATH = path.join(DATA_DIR, "tablets.json");
const HTTPS_KEY_PATH = path.join(ROOT_DIR, "certs", "dev-server-key.pem");
const HTTPS_CERT_PATH = path.join(ROOT_DIR, "certs", "dev-server-cert.pem");
const TEACHER_PIN = typeof process.env.TEACHER_PIN === "string" && process.env.TEACHER_PIN.trim()
  ? process.env.TEACHER_PIN.trim()
  : "2468";
const tabletSessions = new Map();
const teacherSessions = new Map();

app.use(express.json());

app.post("/api/teacher/session", (request, response) => {
  const pin = typeof request.body?.pin === "string" ? request.body.pin.trim() : "";

  if (!pin) {
    response.status(400).json({
      error: "PIN fehlt.",
    });
    return;
  }

  if (pin !== TEACHER_PIN) {
    response.status(401).json({
      error: "PIN stimmt nicht.",
    });
    return;
  }

  response.json({
    success: true,
    session: createTeacherSession(),
  });
});

app.delete("/api/teacher/session", (request, response) => {
  const sessionResult = requireTeacherSession(request);

  if (sessionResult.ok) {
    teacherSessions.delete(sessionResult.token);
  }

  response.status(204).end();
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
    const data = await readJsonFile(SET_INDEX_PATH, { sets: [] });
    const store = await readTabletStore();
    const sets = Array.isArray(data?.sets) ? data.sets : [];

    response.json({
      sets: sets.map((setEntry) => ({
        ...setEntry,
        tablets: getTabletsForSet(store, setEntry?.path),
      })),
    });
  } catch (error) {
    console.error("Unable to load set index:", error);
    response.status(500).json({
      error: "Set-Liste konnte nicht geladen werden.",
    });
  }
});

app.get("/api/runtime-info", (request, response) => {
  response.json({
    publicOrigin: getPublicOrigin(request),
    localIp: getLocalLanIp(),
  });
});

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

    const setIndex = await readJsonFile(SET_INDEX_PATH, { sets: [] });
    const setEntries = Array.isArray(setIndex?.sets) ? setIndex.sets : [];

    response.json({
      tablet: toSafeTablet(tablet),
      subscriptions: normalizeTabletSubscriptions(tablet).map((subscription) => {
        const setEntry = setEntries.find((entry) => entry?.path === subscription.setPath);

        return {
          setPath: subscription.setPath,
          subscribedAt: subscription.subscribedAt,
          title: typeof setEntry?.title === "string" && setEntry.title.trim()
            ? setEntry.title.trim()
            : subscription.setPath,
          description: typeof setEntry?.description === "string" ? setEntry.description.trim() : "",
          cardCount: Number.isFinite(setEntry?.cardCount) ? setEntry.cardCount : null,
          category: typeof setEntry?.category === "string" ? setEntry.category.trim() : "",
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

    const setIndex = await readJsonFile(SET_INDEX_PATH, { sets: [] });
    const setEntries = Array.isArray(setIndex?.sets) ? setIndex.sets : [];
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

app.put("/api/tablets/:tabletId/learning-progress", async (request, response) => {
  const sessionResult = requireTabletSession(request, request.params.tabletId);

  if (!sessionResult.ok) {
    response.status(sessionResult.status).json({
      error: sessionResult.error,
    });
    return;
  }

  const setPath = normalizeSetPath(request.body?.setPath);
  const starStates = normalizeStarStates(request.body?.starStates);

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
    const nextEntry = {
      setPath,
      starStates,
      updatedAt: timestamp,
    };
    const existingIndex = learningProgress.findIndex((entry) => entry.setPath === setPath);

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
    console.error("Unable to save learning progress:", error);
    response.status(500).json({
      error: "Lernstand konnte nicht gespeichert werden.",
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

  if (!pin) {
    response.status(400).json({
      error: "PIN fehlt.",
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

    if (!tablet.registered || !tablet.pinHash) {
      response.status(409).json({
        error: "Tablet ist noch nicht registriert.",
      });
      return;
    }

    if (isTabletLocked(tablet)) {
      response.status(423).json({
        error: "Gerät ist gesperrt. Die Lehrkraft muss die Sperre im Lehrerbereich aufheben.",
        tablet: toSafeTablet(tablet),
      });
      return;
    }

    const isMatch = await bcrypt.compare(pin, tablet.pinHash);

    if (!isMatch) {
      const nextAttempts = normalizeFailedPinAttempts(tablet) + 1;
      const timestamp = new Date().toISOString();

      tablet.failedPinAttempts = nextAttempts;
      tablet.updatedAt = timestamp;

      if (nextAttempts >= MAX_PIN_FAILURES) {
        tablet.lockedAt = timestamp;
        await writeTabletStore(store);

        response.status(423).json({
          error: "Gerät ist nach 3 Fehlversuchen gesperrt. Die Lehrkraft muss die Sperre im Lehrerbereich aufheben.",
          tablet: toSafeTablet(tablet),
        });
        return;
      }

      await writeTabletStore(store);

      response.status(401).json({
        error: `PIN stimmt nicht. Noch ${MAX_PIN_FAILURES - nextAttempts} Versuch${MAX_PIN_FAILURES - nextAttempts === 1 ? "" : "e"}.`,
        tablet: toSafeTablet(tablet),
      });
      return;
    }

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
    });
  } catch (error) {
    console.error("Unable to verify tablet pin:", error);
    response.status(500).json({
      error: "PIN konnte nicht geprüft werden.",
    });
  }
});

app.post("/api/tablets/:tabletId/reset-lock", async (request, response) => {
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

    tablet.failedPinAttempts = 0;
    tablet.lockedAt = null;
    tablet.updatedAt = new Date().toISOString();
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to reset tablet lock:", error);
    response.status(500).json({
      error: "Sperre konnte nicht aufgehoben werden.",
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
  response.sendFile(path.join(ROOT_DIR, "teacher.html"));
});

app.use(express.static(ROOT_DIR));

http.createServer(app).listen(PORT, HOST, () => {
  console.log(`Dino Vocab App listening on http://${HOST}:${PORT}`);
});

const shouldStartLocalHttps = !process.env.RENDER && fs.existsSync(HTTPS_KEY_PATH) && fs.existsSync(HTTPS_CERT_PATH);

if (shouldStartLocalHttps) {
  try {
    const key = fs.readFileSync(HTTPS_KEY_PATH);
    const cert = fs.readFileSync(HTTPS_CERT_PATH);

    https.createServer({ key, cert }, app).listen(HTTPS_PORT, HOST, () => {
      console.log(`Dino Vocab App listening on https://${HOST}:${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error("Unable to start HTTPS server:", error);
  }
} else {
  console.log("HTTPS disabled: Render handles TLS in production, local dev certs are optional.");
}

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
  const store = await readJsonFile(TABLETS_PATH, { tablets: [] });

  return {
    tablets: Array.isArray(store?.tablets)
      ? store.tablets.map((tablet) => ({
          ...tablet,
          subscriptions: normalizeTabletSubscriptions(tablet),
          learningProgress: normalizeTabletLearningProgress(tablet),
          pairingId: normalizePairingId(tablet),
          failedPinAttempts: normalizeFailedPinAttempts(tablet),
          lockedAt: normalizeLockedAt(tablet),
        }))
      : [],
  };
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
    subscriptions: normalizeTabletSubscriptions(tablet),
    progressSetCount: normalizeTabletLearningProgress(tablet).length,
    failedPinAttempts: normalizeFailedPinAttempts(tablet),
    lockedAt: normalizeLockedAt(tablet),
    isLocked: isTabletLocked(tablet),
    createdAt: tablet.createdAt || null,
    updatedAt: tablet.updatedAt || null,
    lastSeenAt: tablet.lastSeenAt || null,
  };
}

function toPublicTablet(tablet) {
  return {
    id: tablet.id,
    label: tablet.label,
    registered: Boolean(tablet.registered),
    isCoupled: Boolean(tablet.registered),
    isLocked: isTabletLocked(tablet),
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

function normalizeFailedPinAttempts(tablet) {
  if (!Number.isFinite(tablet?.failedPinAttempts)) {
    return 0;
  }

  return Math.max(0, Math.trunc(tablet.failedPinAttempts));
}

function normalizeLockedAt(tablet) {
  return typeof tablet?.lockedAt === "string" && tablet.lockedAt.trim()
    ? tablet.lockedAt.trim()
    : null;
}

function isTabletLocked(tablet) {
  return Boolean(normalizeLockedAt(tablet));
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

  tabletSessions.set(token, {
    tabletId,
    expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function createTeacherSession() {
  purgeExpiredSessions(teacherSessions);
  const expiresAt = Date.now() + TEACHER_SESSION_TTL_MS;
  const token = createSessionToken();

  teacherSessions.set(token, {
    expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function purgeExpiredSessions(sessionStore) {
  const now = Date.now();

  for (const [token, session] of sessionStore.entries()) {
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      sessionStore.delete(token);
    }
  }
}

function invalidateTabletSessions(tabletId) {
  for (const [token, session] of tabletSessions.entries()) {
    if (session?.tabletId === tabletId) {
      tabletSessions.delete(token);
    }
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
  purgeExpiredSessions(tabletSessions);
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Bitte zuerst mit PIN anmelden.",
    };
  }

  const session = tabletSessions.get(token);

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

  session.expiresAt = Date.now() + TABLET_SESSION_TTL_MS;
  tabletSessions.set(token, session);

  return {
    ok: true,
    status: 200,
    token,
    session,
  };
}

function requireTeacherSession(request) {
  purgeExpiredSessions(teacherSessions);
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Lehrer-PIN erforderlich.",
    };
  }

  const session = teacherSessions.get(token);

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Lehrer-Sitzung abgelaufen. Bitte PIN erneut eingeben.",
    };
  }

  session.expiresAt = Date.now() + TEACHER_SESSION_TTL_MS;
  teacherSessions.set(token, session);

  return {
    ok: true,
    status: 200,
    token,
    session,
  };
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
      };
    })
    .filter(Boolean);
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
        starStates: normalizeStarStates(entry?.starStates),
        updatedAt: typeof entry?.updatedAt === "string" && entry.updatedAt.trim()
          ? entry.updatedAt.trim()
          : null,
      };
    })
    .filter(Boolean);
}

function normalizeStarStates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const nextStates = {};

  for (const [cardId, rawState] of Object.entries(value)) {
    const normalizedCardId = typeof cardId === "string" ? cardId.trim() : "";
    const normalizedState = typeof rawState === "string" ? rawState.trim() : "";

    if (!normalizedCardId || !isValidStoredStarState(normalizedState)) {
      continue;
    }

    nextStates[normalizedCardId] = normalizedState;
  }

  return nextStates;
}

function isValidStoredStarState(value) {
  return value === "green" || value === "yellow" || value === "orange";
}

function getTabletLearningProgress(tablet, setPath) {
  const normalizedSetPath = normalizeSetPath(setPath);
  const entry = normalizeTabletLearningProgress(tablet).find((progress) => progress.setPath === normalizedSetPath);

  return {
    setPath: normalizedSetPath,
    starStates: entry?.starStates || {},
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
        failedPinAttempts: normalizeFailedPinAttempts(tablet),
        lockedAt: normalizeLockedAt(tablet),
        isLocked: isTabletLocked(tablet),
      };
    });
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
