const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const express = require("express");
const bcrypt = require("bcryptjs");
const fsp = require("fs/promises");
const path = require("path");

const app = express();
app.set("trust proxy", true);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const SET_INDEX_PATH = path.join(ROOT_DIR, "sets", "sets-index.json");
const TABLETS_PATH = path.join(DATA_DIR, "tablets.json");
const HTTPS_KEY_PATH = path.join(ROOT_DIR, "certs", "dev-server-key.pem");
const HTTPS_CERT_PATH = path.join(ROOT_DIR, "certs", "dev-server-cert.pem");

app.use(express.json());

app.get("/api/sets", async (_request, response) => {
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

app.get("/api/tablets/:tabletId", async (request, response) => {
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
  try {
    const store = await readTabletStore();
    const tablet = findTablet(store, request.params.tabletId);

    if (!tablet) {
      response.status(404).json({
        error: "Tablet nicht gefunden.",
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
    tablet.registered = true;
    tablet.subscriptions = normalizeTabletSubscriptions(tablet);
    tablet.createdAt = tablet.createdAt || timestamp;
    tablet.updatedAt = timestamp;
    tablet.lastSeenAt = timestamp;

    await writeTabletStore(store);

    response.json({
      success: true,
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
      error: "Set konnte nicht hinzugefügt werden.",
    });
  }
});

app.delete("/api/tablets/:tabletId/subscriptions", async (request, response) => {
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
    tablet.updatedAt = new Date().toISOString();
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to remove tablet subscription:", error);
    response.status(500).json({
      error: "Set konnte nicht entfernt werden.",
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

    const isMatch = await bcrypt.compare(pin, tablet.pinHash);

    if (!isMatch) {
      response.status(401).json({
        error: "PIN stimmt nicht.",
      });
      return;
    }

    tablet.lastSeenAt = new Date().toISOString();
    tablet.updatedAt = tablet.lastSeenAt;
    await writeTabletStore(store);

    response.json({
      success: true,
      tablet: toSafeTablet(tablet),
    });
  } catch (error) {
    console.error("Unable to verify tablet pin:", error);
    response.status(500).json({
      error: "PIN konnte nicht geprüft werden.",
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
        }))
      : [],
  };
}

async function writeTabletStore(store) {
  await fsp.mkdir(path.dirname(TABLETS_PATH), { recursive: true });
  await fsp.writeFile(TABLETS_PATH, JSON.stringify(store, null, 2));
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
    subscriptions: normalizeTabletSubscriptions(tablet),
    createdAt: tablet.createdAt || null,
    updatedAt: tablet.updatedAt || null,
    lastSeenAt: tablet.lastSeenAt || null,
  };
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
