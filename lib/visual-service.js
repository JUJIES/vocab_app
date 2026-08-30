const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const OpenAI = require("openai");
const sharp = require("sharp");
const { RuntimeJsonStore } = require("./runtime-json-store");
const { createCardContentHash } = require("./set-service");

const ACTIVE_JOB_STATUSES = new Set(["queued", "generating", "applying"]);
const SHEET_COLUMNS = 3;
const SHEET_ROWS = 2;
const SHEET_CAPACITY = SHEET_COLUMNS * SHEET_ROWS;
const TILE_SIZE = 512;

function normalizeAssetStore(value) {
  return {
    version: 1,
    assets: Array.isArray(value?.assets)
      ? value.assets.map(normalizeStoredAsset).filter(Boolean)
      : [],
  };
}

function normalizeStoredAsset(value) {
  const id = normalizeId(value?.id);
  const ownerTeacherId = normalizeId(value?.ownerTeacherId);
  const setId = normalizeId(value?.setId);
  const cardId = normalizeId(value?.cardId);
  if (!id || !ownerTeacherId || !setId || !cardId) {
    return null;
  }
  return {
    id,
    ownerTeacherId,
    setId,
    cardId,
    source: value?.source === "single" ? "single" : "sheet",
    parentAssetId: normalizeId(value?.parentAssetId),
    width: Number.isFinite(value?.width) ? Math.max(1, Math.trunc(value.width)) : TILE_SIZE,
    height: Number.isFinite(value?.height) ? Math.max(1, Math.trunc(value.height)) : TILE_SIZE,
    alt: normalizeText(value?.alt, 300),
    contentHash: normalizeText(value?.contentHash, 128),
    createdAt: normalizeTimestamp(value?.createdAt),
  };
}

function normalizeJobStore(value) {
  return {
    version: 1,
    jobs: Array.isArray(value?.jobs)
      ? value.jobs.map(normalizeStoredJob).filter(Boolean).slice(-200)
      : [],
  };
}

function normalizeStoredJob(value) {
  const id = normalizeId(value?.id);
  const ownerTeacherId = normalizeId(value?.ownerTeacherId);
  const setId = normalizeId(value?.setId);
  const type = value?.type === "single" ? "single" : "sheet";
  if (!id || !ownerTeacherId || !setId) {
    return null;
  }
  const status = ["queued", "generating", "applying", "completed", "failed", "interrupted"]
    .includes(value?.status) ? value.status : "failed";
  return {
    id,
    ownerTeacherId,
    setId,
    type,
    status,
    cards: Array.isArray(value?.cards)
      ? value.cards.map(normalizeJobCard).filter(Boolean)
      : [],
    totalCards: Number.isFinite(value?.totalCards) ? Math.max(0, Math.trunc(value.totalCards)) : 0,
    totalSheets: Number.isFinite(value?.totalSheets) ? Math.max(0, Math.trunc(value.totalSheets)) : 0,
    completedSheets: Number.isFinite(value?.completedSheets) ? Math.max(0, Math.trunc(value.completedSheets)) : 0,
    activeSheet: Number.isFinite(value?.activeSheet) ? Math.max(0, Math.trunc(value.activeSheet)) : 0,
    createdCount: Number.isFinite(value?.createdCount) ? Math.max(0, Math.trunc(value.createdCount)) : 0,
    attachedCount: Number.isFinite(value?.attachedCount) ? Math.max(0, Math.trunc(value.attachedCount)) : 0,
    skippedCount: Number.isFinite(value?.skippedCount) ? Math.max(0, Math.trunc(value.skippedCount)) : 0,
    error: normalizeText(value?.error, 500),
    createdAt: normalizeTimestamp(value?.createdAt),
    updatedAt: normalizeTimestamp(value?.updatedAt),
    completedAt: normalizeTimestamp(value?.completedAt),
  };
}

function normalizeJobCard(value) {
  const id = normalizeId(value?.id);
  const front = normalizeText(value?.front, 500);
  const back = normalizeText(value?.back, 1000);
  const contentHash = normalizeText(value?.contentHash, 128);
  if (!id || !front || !back || !contentHash) {
    return null;
  }
  return {
    id,
    front,
    back,
    contentHash,
    previousAssetId: normalizeId(value?.previousAssetId),
  };
}

class VisualService {
  constructor({
    dataDir,
    setService,
    apiKey = process.env.OPENAI_API_KEY || "",
    model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    client = null,
    imageProcessor = sharp,
  }) {
    this.dataDir = dataDir;
    this.setService = setService;
    this.model = normalizeText(model, 120) || "gpt-image-2";
    this.client = client || (normalizeText(apiKey, 1000) ? new OpenAI({ apiKey: apiKey.trim() }) : null);
    this.imageProcessor = imageProcessor;
    this.assetDir = path.join(dataDir, "visual-assets");
    this.assetStore = new RuntimeJsonStore(path.join(dataDir, "visual-assets.json"), {
      defaultValue: { version: 1, assets: [] },
      normalize: normalizeAssetStore,
    });
    this.jobStore = new RuntimeJsonStore(path.join(dataDir, "visual-jobs.json"), {
      defaultValue: { version: 1, jobs: [] },
      normalize: normalizeJobStore,
    });
    this.runningJobIds = new Set();
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async recoverInterruptedJobs() {
    await this.jobStore.mutate((store) => {
      const timestamp = new Date().toISOString();
      for (const job of store.jobs) {
        if (ACTIVE_JOB_STATUSES.has(job.status)) {
          job.status = "interrupted";
          job.error = "Die Erstellung wurde durch einen Neustart unterbrochen. Bitte erneut starten.";
          job.updatedAt = timestamp;
          job.completedAt = timestamp;
        }
      }
    });
  }

  async startMissingVisuals(teacherId, setId) {
    this.assertConfigured();
    const setEntry = await this.requirePublishedSet(teacherId, setId);
    const cards = setEntry.cards.filter((card) => !card.visual).map(toJobCard);
    if (cards.length === 0) {
      throw createVisualError("Alle Karten haben bereits ein Bild.", 409, "NO_MISSING_VISUALS");
    }
    return this.createAndRunJob({ teacherId, setId, type: "sheet", cards });
  }

  async startCardRegeneration(teacherId, setId, cardId) {
    this.assertConfigured();
    const setEntry = await this.requirePublishedSet(teacherId, setId);
    const card = setEntry.cards.find((entry) => entry.id === normalizeId(cardId));
    if (!card) {
      throw createVisualError("Karte nicht gefunden.", 404, "CARD_NOT_FOUND");
    }
    return this.createAndRunJob({ teacherId, setId, type: "single", cards: [toJobCard(card)] });
  }

  async createAndRunJob({ teacherId, setId, type, cards }) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const timestamp = new Date().toISOString();
    const job = {
      id: `vj_${crypto.randomUUID()}`,
      ownerTeacherId: normalizedTeacherId,
      setId: normalizedSetId,
      type,
      status: "queued",
      cards,
      totalCards: cards.length,
      totalSheets: type === "sheet" ? Math.ceil(cards.length / SHEET_CAPACITY) : 1,
      completedSheets: 0,
      activeSheet: 0,
      createdCount: 0,
      attachedCount: 0,
      skippedCount: 0,
      error: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };

    await this.jobStore.mutate((store) => {
      const activeJob = store.jobs.find((entry) => (
        entry.ownerTeacherId === normalizedTeacherId
        && entry.setId === normalizedSetId
        && ACTIVE_JOB_STATUSES.has(entry.status)
      ));
      if (activeJob) {
        throw createVisualError("Für dieses Set werden bereits Bilder erstellt.", 409, "VISUAL_JOB_ACTIVE");
      }
      store.jobs.push(job);
      store.jobs = store.jobs.slice(-200);
    });

    setImmediate(() => {
      void this.runJob(job.id);
    });
    return toJobResponse(job);
  }

  async runJob(jobId) {
    if (this.runningJobIds.has(jobId)) {
      return;
    }
    this.runningJobIds.add(jobId);
    try {
      let job = await this.updateJob(jobId, {
        status: "generating",
        error: "",
      });
      if (!job) {
        return;
      }

      const generatedAssets = [];
      if (job.type === "single") {
        await this.updateJob(job.id, { activeSheet: 1 });
        generatedAssets.push(await this.generateSingleAsset(job, job.cards[0]));
        job = await this.updateJob(job.id, {
          completedSheets: 1,
          createdCount: 1,
        });
      } else {
        const groups = chunk(job.cards, SHEET_CAPACITY);
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
          await this.updateJob(job.id, { activeSheet: groupIndex + 1 });
          const assets = await this.generateSheetAssets(job, groups[groupIndex], groupIndex + 1);
          generatedAssets.push(...assets);
          job = await this.updateJob(job.id, {
            completedSheets: groupIndex + 1,
            createdCount: generatedAssets.length,
          });
        }
      }

      await this.updateJob(job.id, { status: "applying" });
      const assignmentResult = await this.setService.assignCardVisuals(
        job.ownerTeacherId,
        job.setId,
        generatedAssets.map((asset) => ({
          cardId: asset.cardId,
          contentHash: asset.contentHash,
          visual: toCardVisual(asset),
        })),
      );
      const completedAt = new Date().toISOString();
      await this.updateJob(job.id, {
        status: "completed",
        activeSheet: 0,
        attachedCount: assignmentResult.attachedCardIds.length,
        skippedCount: assignmentResult.skippedCardIds.length,
        completedAt,
      });
    } catch (error) {
      console.error("Unable to generate card visuals:", error);
      await this.updateJob(jobId, {
        status: "failed",
        activeSheet: 0,
        error: toPublicVisualError(error),
        completedAt: new Date().toISOString(),
      });
    } finally {
      this.runningJobIds.delete(jobId);
    }
  }

  async generateSheetAssets(job, cards, sheetNumber) {
    const response = await this.generateImage({
      model: this.model,
      prompt: buildSheetPrompt(cards),
      n: 1,
      size: "1536x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      user: hashTeacherIdentifier(job.ownerTeacherId),
    });
    const sourceBuffer = decodeImageResponse(response);
    const normalizedSheet = await this.imageProcessor(sourceBuffer)
      .resize(SHEET_COLUMNS * TILE_SIZE, SHEET_ROWS * TILE_SIZE, { fit: "fill" })
      .webp({ quality: 90 })
      .toBuffer();
    const assets = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const asset = createAssetRecord(job, card, {
        source: "sheet",
        sheetNumber,
      });
      const column = index % SHEET_COLUMNS;
      const row = Math.floor(index / SHEET_COLUMNS);
      const tileBuffer = await this.imageProcessor(normalizedSheet)
        .extract({
          left: column * TILE_SIZE,
          top: row * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
      await this.persistAsset(asset, tileBuffer);
      assets.push(asset);
    }
    return assets;
  }

  async generateSingleAsset(job, card) {
    const response = await this.generateImage({
      model: this.model,
      prompt: buildSinglePrompt(card),
      n: 1,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      user: hashTeacherIdentifier(job.ownerTeacherId),
    });
    const sourceBuffer = decodeImageResponse(response);
    const asset = createAssetRecord(job, card, { source: "single" });
    const tileBuffer = await this.imageProcessor(sourceBuffer)
      .resize(TILE_SIZE, TILE_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    await this.persistAsset(asset, tileBuffer);
    return asset;
  }

  async persistAsset(asset, buffer) {
    await fs.mkdir(this.assetDir, { recursive: true });
    const filePath = this.getAssetPath(asset.id);
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(5).toString("hex")}.tmp`;
    await fs.writeFile(temporaryPath, buffer, { mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
    await this.assetStore.mutate((store) => {
      store.assets.push(asset);
    });
  }

  async generateImage(parameters) {
    const maximumAttempts = 4;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        return await this.client.images.generate(parameters);
      } catch (error) {
        const status = Number.isFinite(error?.status) ? error.status : 0;
        const mayRetry = status === 429 || status >= 500;
        if (!mayRetry || attempt === maximumAttempts) {
          throw error;
        }
        await wait(resolveRetryDelay(error, attempt));
      }
    }
    throw createVisualError("Bildgenerierung ist nicht verfügbar.", 502, "IMAGE_REQUEST_FAILED");
  }

  async listAssets(teacherId, setId) {
    await this.requireOwnedSet(teacherId, setId);
    const store = await this.assetStore.read();
    return store.assets
      .filter((asset) => asset.ownerTeacherId === normalizeId(teacherId) && asset.setId === normalizeId(setId))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .map(toAssetResponse);
  }

  async selectAsset(teacherId, setId, cardId, assetId) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const normalizedCardId = normalizeId(cardId);
    const store = await this.assetStore.read();
    const asset = store.assets.find((entry) => (
      entry.id === normalizeId(assetId)
      && entry.ownerTeacherId === normalizedTeacherId
      && entry.setId === normalizedSetId
      && entry.cardId === normalizedCardId
    ));
    if (!asset) {
      throw createVisualError("Bild nicht gefunden.", 404, "VISUAL_ASSET_NOT_FOUND");
    }
    return this.setService.assignCardVisuals(normalizedTeacherId, normalizedSetId, [{
      cardId: normalizedCardId,
      contentHash: asset.contentHash,
      visual: toCardVisual(asset),
    }]);
  }

  async listJobs(teacherId, { setId = "" } = {}) {
    const store = await this.jobStore.read();
    return store.jobs
      .filter((job) => (
        job.ownerTeacherId === normalizeId(teacherId)
        && (!setId || job.setId === normalizeId(setId))
      ))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, setId ? 8 : 30)
      .map(toJobResponse);
  }

  async getAssetFile(assetId) {
    const normalizedAssetId = normalizeId(assetId);
    if (!normalizedAssetId) {
      return null;
    }
    const filePath = this.getAssetPath(normalizedAssetId);
    try {
      const file = await fs.stat(filePath);
      return file.isFile() ? filePath : null;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  getAssetPath(assetId) {
    return path.join(this.assetDir, `${assetId}.webp`);
  }

  async updateJob(jobId, patch) {
    return this.jobStore.mutate((store) => {
      const job = store.jobs.find((entry) => entry.id === normalizeId(jobId));
      if (!job) {
        return null;
      }
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      return { ...job };
    });
  }

  assertConfigured() {
    if (!this.client) {
      throw createVisualError(
        "Bildgenerierung ist noch nicht konfiguriert.",
        503,
        "OPENAI_IMAGES_NOT_CONFIGURED",
      );
    }
  }

  async requireOwnedSet(teacherId, setId) {
    const setEntry = await this.setService.getOwnedSet(teacherId, setId);
    if (!setEntry) {
      throw createVisualError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
    }
    return setEntry;
  }

  async requirePublishedSet(teacherId, setId) {
    const setEntry = await this.requireOwnedSet(teacherId, setId);
    if (setEntry.status !== "published") {
      throw createVisualError("Bilder können nach dem Veröffentlichen erstellt werden.", 409, "SET_NOT_PUBLISHED");
    }
    return setEntry;
  }
}

function toJobCard(card) {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    contentHash: createCardContentHash(card),
    previousAssetId: normalizeId(card.visual?.assetId),
  };
}

function createAssetRecord(job, card, { source }) {
  return {
    id: `vis_${crypto.randomUUID()}`,
    ownerTeacherId: job.ownerTeacherId,
    setId: job.setId,
    cardId: card.id,
    source,
    parentAssetId: card.previousAssetId,
    width: TILE_SIZE,
    height: TILE_SIZE,
    alt: `Lernbild zu ${card.front}`,
    contentHash: card.contentHash,
    createdAt: new Date().toISOString(),
  };
}

function toCardVisual(asset) {
  return {
    assetId: asset.id,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    createdAt: asset.createdAt,
  };
}

function toAssetResponse(asset) {
  return {
    id: asset.id,
    setId: asset.setId,
    cardId: asset.cardId,
    source: asset.source,
    parentAssetId: asset.parentAssetId,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    contentHash: asset.contentHash,
    createdAt: asset.createdAt,
    url: `/media/visuals/${encodeURIComponent(asset.id)}.webp`,
  };
}

function toJobResponse(job) {
  return {
    id: job.id,
    setId: job.setId,
    type: job.type,
    status: job.status,
    totalCards: job.totalCards,
    totalSheets: job.totalSheets,
    completedSheets: job.completedSheets,
    activeSheet: job.activeSheet,
    createdCount: job.createdCount,
    attachedCount: job.attachedCount,
    skippedCount: job.skippedCount,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

function buildSheetPrompt(cards) {
  const cells = [...cards];
  while (cells.length < SHEET_CAPACITY) {
    cells.push(null);
  }
  const cellCopy = cells.map((card, index) => card
    ? `${index + 1}. ${card.front} — ${card.back}`
    : `${index + 1}. empty neutral background`).join("\n");
  return [
    "Create one classroom learning picture sheet as an exact 3-column by 2-row grid.",
    "Each equal square cell must be a fully independent, centered illustration for its numbered concept.",
    "Use the same calm, modern, friendly editorial illustration style in every cell: simple shapes, clear silhouette, restrained colors, dark navy background, no decorative clutter.",
    "Never include letters, words, captions, numbers, symbols, borders, dividers, watermarks, or UI. Do not let objects cross cell boundaries.",
    "For abstract vocabulary, show one concrete, age-appropriate visual metaphor. Avoid stereotypes and ambiguous scenes.",
    "Cell order is left-to-right in the top row, then left-to-right in the bottom row:",
    cellCopy,
  ].join("\n");
}

function buildSinglePrompt(card) {
  return [
    `Create one calm classroom learning illustration for the concept: ${card.front} — ${card.back}.`,
    "Centered single subject or unambiguous scene, simple shapes, clear silhouette, restrained colors, dark navy background, modern friendly editorial style.",
    "No letters, words, captions, numbers, symbols, borders, watermarks, or UI. Avoid decorative clutter and stereotypes.",
  ].join("\n");
}

function decodeImageResponse(response) {
  const encoded = response?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded) {
    throw createVisualError("Die Bildantwort war leer.", 502, "EMPTY_IMAGE_OUTPUT");
  }
  return Buffer.from(encoded, "base64");
}

function hashTeacherIdentifier(teacherId) {
  return crypto.createHash("sha256").update(String(teacherId || "teacher")).digest("hex");
}

function toPublicVisualError(error) {
  const status = Number.isFinite(error?.status) ? error.status : 0;
  if (status === 401 || status === 403) {
    return "Bildgenerierung ist serverseitig nicht korrekt konfiguriert.";
  }
  if (status === 429) {
    return "Bildgenerierung ist gerade ausgelastet. Bitte später erneut versuchen.";
  }
  return error?.code === "SET_NOT_FOUND"
    ? "Das Set wurde während der Erstellung entfernt."
    : "Bilder konnten nicht vollständig erstellt werden.";
}

function resolveRetryDelay(error, attempt) {
  const headers = error?.headers;
  const retryAfterMs = Number(headers?.get?.("retry-after-ms"));
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 60_000);
  }
  const retryAfterSeconds = Number(headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 60_000);
  }
  return Math.min((2 ** (attempt - 1)) * 5000, 30_000);
}

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function createVisualError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]{0,127}$/.test(normalized) ? normalized : "";
}

function normalizeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

module.exports = {
  VisualService,
  buildSheetPrompt,
  normalizeAssetStore,
  normalizeJobStore,
};
