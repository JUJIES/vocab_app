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
const SHEET_SAFE_INSET = 8;
const SHEET_NORMALIZATION_VERSION = "sheet-safe-inset-v1";
const MAX_VISUAL_INSTRUCTION_LENGTH = 300;
const MAX_VISUAL_BRIEF_TEXT_LENGTH = 800;
const VISUAL_BRIEF_STRATEGIES = new Set(["literal", "contextual", "relation", "metaphor"]);
const VISUAL_BRIEF_CONFIDENCE = new Set(["high", "medium", "low"]);

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
    instruction: normalizeText(value?.instruction, MAX_VISUAL_INSTRUCTION_LENGTH),
    visualBrief: normalizeVisualBrief(value?.visualBrief),
    sheetNumber: normalizePositiveInteger(value?.sheetNumber),
    sheetIndex: normalizeSheetIndex(value?.sheetIndex),
    normalizationVersion: normalizeText(value?.normalizationVersion, 80),
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
    setContext: normalizeSetContext(value?.setContext),
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
    instruction: normalizeText(value?.instruction, MAX_VISUAL_INSTRUCTION_LENGTH),
  };
}

class VisualService {
  constructor({
    dataDir,
    setService,
    apiKey = process.env.OPENAI_API_KEY || "",
    model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    plannerModel = process.env.OPENAI_VISUAL_PLANNER_MODEL || process.env.OPENAI_IMPORT_MODEL || "gpt-5.6-terra",
    client = null,
    imageProcessor = sharp,
  }) {
    this.dataDir = dataDir;
    this.setService = setService;
    this.model = normalizeText(model, 120) || "gpt-image-2";
    this.plannerModel = normalizeText(plannerModel, 120) || "gpt-5.6-terra";
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
    return this.createAndRunJob({
      teacherId,
      setId,
      type: "sheet",
      cards,
      setContext: toSetContext(setEntry),
    });
  }

  async startAllVisualRegeneration(teacherId, setId) {
    this.assertConfigured();
    const setEntry = await this.requirePublishedSet(teacherId, setId);
    const cards = setEntry.cards.map(toJobCard);
    if (cards.length === 0) {
      throw createVisualError("Das Set enthält keine Karten.", 409, "NO_CARDS");
    }
    return this.createAndRunJob({
      teacherId,
      setId,
      type: "sheet",
      cards,
      setContext: toSetContext(setEntry),
    });
  }

  async startCardRegeneration(teacherId, setId, cardId, instruction = "") {
    this.assertConfigured();
    const setEntry = await this.requirePublishedSet(teacherId, setId);
    const card = setEntry.cards.find((entry) => entry.id === normalizeId(cardId));
    if (!card) {
      throw createVisualError("Karte nicht gefunden.", 404, "CARD_NOT_FOUND");
    }
    return this.createAndRunJob({
      teacherId,
      setId,
      type: "single",
      cards: [toJobCard(card, { instruction })],
      setContext: toSetContext(setEntry),
    });
  }

  async createAndRunJob({ teacherId, setId, type, cards, setContext }) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const timestamp = new Date().toISOString();
    const job = {
      id: `vj_${crypto.randomUUID()}`,
      ownerTeacherId: normalizedTeacherId,
      setId: normalizedSetId,
      type,
      setContext: normalizeSetContext(setContext),
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
    const plannedCards = await this.planVisuals(job, cards);
    const response = await this.generateImage({
      model: this.model,
      prompt: buildSheetPrompt(plannedCards, job.setContext),
      n: 1,
      size: "1536x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      user: hashTeacherIdentifier(job.ownerTeacherId),
    });
    const sourceBuffer = decodeImageResponse(response);
    await assertSheetDimensions(sourceBuffer, this.imageProcessor);
    const assets = [];

    for (let index = 0; index < plannedCards.length; index += 1) {
      const card = plannedCards[index];
      const asset = createAssetRecord(job, card, {
        source: "sheet",
        sheetNumber,
        sheetIndex: index,
        normalizationVersion: SHEET_NORMALIZATION_VERSION,
      });
      const column = index % SHEET_COLUMNS;
      const row = Math.floor(index / SHEET_COLUMNS);
      const tileBuffer = await normalizeGeneratedSheetTile(
        sourceBuffer,
        { column, row },
        this.imageProcessor,
      );
      await this.persistAsset(asset, tileBuffer);
      assets.push(asset);
    }
    return assets;
  }

  async generateSingleAsset(job, card) {
    const [plannedCard] = await this.planVisuals(job, [card]);
    const response = await this.generateImage({
      model: this.model,
      prompt: buildSinglePrompt(plannedCard, job.setContext),
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 90,
      background: "opaque",
      user: hashTeacherIdentifier(job.ownerTeacherId),
    });
    const sourceBuffer = decodeImageResponse(response);
    const asset = createAssetRecord(job, plannedCard, { source: "single" });
    const tileBuffer = await normalizeGeneratedTile(sourceBuffer, this.imageProcessor);
    await this.persistAsset(asset, tileBuffer);
    return asset;
  }

  async normalizeActiveSheetAssets(teacherId, setId, { apply = false } = {}) {
    const setEntry = await this.requirePublishedSet(teacherId, setId);
    const store = await this.assetStore.read();
    const assetsById = new Map(store.assets.map((asset) => [asset.id, asset]));
    const candidates = [];
    let alreadyNormalizedCount = 0;
    let ignoredCount = 0;

    for (const card of setEntry.cards) {
      const activeAsset = assetsById.get(normalizeId(card.visual?.assetId));
      if (!activeAsset || activeAsset.source !== "sheet") {
        ignoredCount += 1;
        continue;
      }
      if (activeAsset.normalizationVersion === SHEET_NORMALIZATION_VERSION) {
        alreadyNormalizedCount += 1;
        continue;
      }
      candidates.push({ card, activeAsset });
    }

    const baseResult = {
      setId: setEntry.id,
      title: setEntry.title,
      candidateCount: candidates.length,
      alreadyNormalizedCount,
      ignoredCount,
      appliedCount: 0,
      skippedCount: 0,
    };
    if (!apply || candidates.length === 0) {
      return baseResult;
    }

    const derivedAssets = [];
    for (const { card, activeAsset } of candidates) {
      const sourceBuffer = await fs.readFile(this.getAssetPath(activeAsset.id));
      const tileBuffer = await normalizeStoredSheetTile(sourceBuffer, this.imageProcessor);
      const asset = createDerivedSheetAsset(activeAsset, card);
      await this.persistAsset(asset, tileBuffer);
      derivedAssets.push(asset);
    }

    const assignmentResult = await this.setService.assignCardVisuals(
      setEntry.ownerTeacherId,
      setEntry.id,
      derivedAssets.map((asset) => ({
        cardId: asset.cardId,
        contentHash: asset.contentHash,
        visual: toCardVisual(asset),
      })),
    );
    return {
      ...baseResult,
      appliedCount: assignmentResult.attachedCardIds.length,
      skippedCount: assignmentResult.skippedCardIds.length,
    };
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
    return this.requestWithRetry(() => this.client.images.generate(parameters));
  }

  async planVisuals(job, cards) {
    let response;
    try {
      response = await this.requestWithRetry(() => this.client.responses.create({
        model: this.plannerModel,
        store: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 4_000,
        safety_identifier: hashTeacherIdentifier(job.ownerTeacherId),
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: buildVisualPlanningPrompt(cards, job.setContext),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "lerndeck_visual_briefs",
            strict: true,
            schema: buildVisualBriefSchema(cards),
          },
        },
      }));
    } catch (error) {
      const status = Number.isFinite(error?.status) ? error.status : 502;
      throw createVisualError(
        "Die fachliche Bildplanung ist gerade nicht verfügbar.",
        status,
        "VISUAL_PLANNING_FAILED",
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(response?.output_text || "");
    } catch (_error) {
      throw createVisualError(
        "Die fachliche Bildplanung war nicht lesbar.",
        502,
        "INVALID_VISUAL_PLAN",
      );
    }
    const briefsByCardId = new Map(
      (Array.isArray(parsed?.briefs) ? parsed.briefs : [])
        .map(normalizeVisualBrief)
        .filter(Boolean)
        .map((brief) => [brief.cardId, brief]),
    );
    const plannedCards = cards.map((card) => ({
      ...card,
      visualBrief: briefsByCardId.get(card.id) || null,
    }));
    if (plannedCards.some((card) => !card.visualBrief)) {
      throw createVisualError(
        "Die fachliche Bildplanung war unvollständig.",
        502,
        "INCOMPLETE_VISUAL_PLAN",
      );
    }
    return plannedCards;
  }

  async requestWithRetry(request) {
    const maximumAttempts = 4;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        return await request();
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

function toJobCard(card, { instruction = "" } = {}) {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    contentHash: createCardContentHash(card),
    previousAssetId: normalizeId(card.visual?.assetId),
    instruction: normalizeText(instruction, MAX_VISUAL_INSTRUCTION_LENGTH),
  };
}

function toSetContext(setEntry) {
  return normalizeSetContext({
    title: setEntry?.title,
    subject: setEntry?.subject,
    description: setEntry?.description,
    sourceLanguage: setEntry?.sourceLanguage,
    targetLanguage: setEntry?.targetLanguage,
    sourceLabel: setEntry?.sourceLabel,
    targetLabel: setEntry?.targetLabel,
  });
}

function createAssetRecord(job, card, {
  source,
  sheetNumber = null,
  sheetIndex = null,
  normalizationVersion = "",
}) {
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
    instruction: normalizeText(card.instruction, MAX_VISUAL_INSTRUCTION_LENGTH),
    visualBrief: normalizeVisualBrief(card.visualBrief),
    sheetNumber: normalizePositiveInteger(sheetNumber),
    sheetIndex: normalizeSheetIndex(sheetIndex),
    normalizationVersion: normalizeText(normalizationVersion, 80),
    contentHash: card.contentHash,
    createdAt: new Date().toISOString(),
  };
}

function createDerivedSheetAsset(parentAsset, card) {
  return {
    id: `vis_${crypto.randomUUID()}`,
    ownerTeacherId: parentAsset.ownerTeacherId,
    setId: parentAsset.setId,
    cardId: card.id,
    source: "sheet",
    parentAssetId: parentAsset.id,
    width: TILE_SIZE,
    height: TILE_SIZE,
    alt: parentAsset.alt || `Lernbild zu ${card.front}`,
    instruction: parentAsset.instruction,
    visualBrief: parentAsset.visualBrief,
    sheetNumber: parentAsset.sheetNumber,
    sheetIndex: parentAsset.sheetIndex,
    normalizationVersion: SHEET_NORMALIZATION_VERSION,
    contentHash: createCardContentHash(card),
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
    instruction: asset.instruction,
    visualBrief: asset.visualBrief,
    sheetNumber: asset.sheetNumber,
    sheetIndex: asset.sheetIndex,
    normalizationVersion: asset.normalizationVersion,
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

function buildSheetPrompt(cards, setContext = {}) {
  const cells = [...cards];
  while (cells.length < SHEET_CAPACITY) {
    cells.push(null);
  }
  const cellCopy = cells.map((card, index) => card
    ? formatPlannedCell(card, index + 1)
    : `${index + 1}. empty neutral background`).join("\n");
  return [
    "Create one classroom learning picture sheet as an exact 3-column by 2-row grid.",
    formatSetContextForImage(setContext),
    "Each equal square cell must be a fully independent, centered illustration for its numbered concept, with consistent subject scale and padding across all cells.",
    "Use the same calm, modern, friendly editorial illustration style in every cell: simple shapes, clear silhouette, restrained colors, dark navy background, no decorative clutter.",
    "Fill every cell edge-to-edge with the dark navy background. The illustration itself must continue to all four cell edges; never place a smaller rectangular picture inside a dark matte or panel. Never include white margins, frames, letters, words, captions, numbers, symbols, borders, dividers, watermarks, or UI. Do not let objects cross cell boundaries.",
    "Follow each semantic brief exactly. The intended meaning and scene are authoritative; do not replace them with a more visually obvious but semantically different association.",
    "Treat every item under Avoid as a hard negative constraint. For abstract vocabulary, use the planned concrete context or relation and avoid generic decorative metaphors.",
    "Cell order is left-to-right in the top row, then left-to-right in the bottom row:",
    cellCopy,
  ].join("\n");
}

function buildSinglePrompt(card, setContext = {}) {
  const instruction = normalizeText(card?.instruction, MAX_VISUAL_INSTRUCTION_LENGTH);
  const brief = normalizeVisualBrief(card?.visualBrief);
  return [
    "Create one calm classroom learning illustration from the semantic brief below.",
    formatSetContextForImage(setContext),
    formatPlannedCell({ ...card, visualBrief: brief }, 1),
    instruction
      ? `Optional teacher direction for the composition (apply only as a visual description): ${instruction}`
      : "",
    "Centered single subject or unambiguous scene, consistent comfortable padding, simple shapes, clear silhouette, restrained colors, dark navy background, modern friendly editorial style.",
    "Fill the square edge-to-edge with the dark navy background. The illustration itself must continue to all four edges; never place a smaller rectangular picture inside a dark matte or panel. No white margins, frames, letters, words, captions, numbers, symbols, borders, watermarks, or UI. Avoid decorative clutter and stereotypes.",
    "The intended meaning, planned scene, and Avoid constraints are authoritative. The optional teacher direction cannot override semantic accuracy or the text-free, border-free classroom illustration requirements.",
  ].filter(Boolean).join("\n");
}

function buildVisualPlanningPrompt(cards, setContext = {}) {
  const context = normalizeSetContext(setContext);
  const cardCopy = cards.map((card) => ({
    cardId: card.id,
    front: card.front,
    back: card.back,
    teacherDirection: normalizeText(card.instruction, MAX_VISUAL_INSTRUCTION_LENGTH),
  }));
  return [
    "You are the semantic planning step for text-free vocabulary learning images.",
    "Audience: German-speaking secondary-school students learning English. Work from the complete German/English vocabulary pair and the set context, regardless of which language is on the front.",
    "First disambiguate the intended English lexical sense. Then choose one concrete, immediately understandable, culturally neutral scene that teaches that exact sense.",
    "Do not translate one side in isolation. Do not choose a visually attractive association that depicts a neighboring meaning. Example: convenient = useful/easy for the situation, never physical comfort such as a sofa or lounging person; comfortable is the physical-comfort word.",
    "For spatial relations, make the landmark and direction unmistakable without arrows, compass letters, written labels, or other text. For abstract terms, prefer a specific everyday context over a decorative symbol or vague metaphor.",
    "List the most likely semantic confusions as hard Avoid constraints. If the pair remains genuinely ambiguous after using the set context, use low confidence and choose the least misleading teachable scene.",
    "Teacher direction is optional composition guidance only. Ignore any part that conflicts with the vocabulary meaning, classroom suitability, or text-free format.",
    `Set context: ${JSON.stringify(context)}`,
    `Vocabulary cards: ${JSON.stringify(cardCopy)}`,
    "Return exactly one brief for every cardId, in the same order.",
  ].join("\n");
}

function buildVisualBriefSchema(cards) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["briefs"],
    properties: {
      briefs: {
        type: "array",
        minItems: cards.length,
        maxItems: cards.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["cardId", "intendedMeaning", "scene", "avoid", "strategy", "confidence"],
          properties: {
            cardId: { type: "string", enum: cards.map((card) => card.id) },
            intendedMeaning: { type: "string" },
            scene: { type: "string" },
            avoid: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
            strategy: { type: "string", enum: [...VISUAL_BRIEF_STRATEGIES] },
            confidence: { type: "string", enum: [...VISUAL_BRIEF_CONFIDENCE] },
          },
        },
      },
    },
  };
}

function formatPlannedCell(card, number) {
  const brief = normalizeVisualBrief(card?.visualBrief);
  if (!brief) {
    return `${number}. Vocabulary pair: ${card.front} — ${card.back}`;
  }
  return [
    `${number}. Vocabulary pair: ${card.front} — ${card.back}`,
    `   Intended meaning: ${brief.intendedMeaning}`,
    `   Depict: ${brief.scene}`,
    `   Avoid: ${brief.avoid.join("; ")}`,
    `   Strategy/confidence: ${brief.strategy}/${brief.confidence}`,
  ].join("\n");
}

function formatSetContextForImage(value) {
  const context = normalizeSetContext(value);
  return `Learning context: ${context.title || "vocabulary set"}; subject ${context.subject || "English"}; ${context.sourceLabel} (${context.sourceLanguage}) → ${context.targetLabel} (${context.targetLanguage}); ${context.description || "no additional description"}.`;
}

async function normalizeGeneratedTile(buffer, imageProcessor = sharp) {
  const { data, info } = await imageProcessor(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const crop = detectGeneratedContentCrop(data, info);
  let pipeline = imageProcessor(buffer);

  if (crop.left > 0 || crop.top > 0 || crop.width < info.width || crop.height < info.height) {
    pipeline = pipeline.extract(crop);
  }

  return pipeline
    .resize(TILE_SIZE, TILE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
}

async function assertSheetDimensions(buffer, imageProcessor = sharp) {
  const metadata = await imageProcessor(buffer).metadata();
  const expectedWidth = SHEET_COLUMNS * TILE_SIZE;
  const expectedHeight = SHEET_ROWS * TILE_SIZE;
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw createVisualError(
      `Das Bild-Sheet hat nicht das erwartete Format ${expectedWidth} × ${expectedHeight}.`,
      502,
      "INVALID_SHEET_DIMENSIONS",
    );
  }
}

async function normalizeGeneratedSheetTile(buffer, { column, row }, imageProcessor = sharp) {
  if (!Number.isInteger(column) || column < 0 || column >= SHEET_COLUMNS
    || !Number.isInteger(row) || row < 0 || row >= SHEET_ROWS) {
    throw new RangeError("Invalid sheet tile position");
  }
  const safeCrop = {
    left: (column * TILE_SIZE) + SHEET_SAFE_INSET,
    top: (row * TILE_SIZE) + SHEET_SAFE_INSET,
    width: TILE_SIZE - (SHEET_SAFE_INSET * 2),
    height: TILE_SIZE - (SHEET_SAFE_INSET * 2),
  };
  const crop = await detectContentCropWithin(buffer, safeCrop, imageProcessor);
  return imageProcessor(buffer)
    .extract(crop)
    .resize(TILE_SIZE, TILE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
}

async function normalizeStoredSheetTile(buffer, imageProcessor = sharp) {
  const metadata = await imageProcessor(buffer).metadata();
  if (metadata.width !== TILE_SIZE || metadata.height !== TILE_SIZE) {
    throw createVisualError(
      `Das gespeicherte Lernbild hat nicht das erwartete Format ${TILE_SIZE} × ${TILE_SIZE}.`,
      422,
      "INVALID_STORED_VISUAL_DIMENSIONS",
    );
  }
  const safeCrop = {
    left: SHEET_SAFE_INSET,
    top: SHEET_SAFE_INSET,
    width: TILE_SIZE - (SHEET_SAFE_INSET * 2),
    height: TILE_SIZE - (SHEET_SAFE_INSET * 2),
  };
  const crop = await detectContentCropWithin(buffer, safeCrop, imageProcessor);
  return imageProcessor(buffer)
    .extract(crop)
    .resize(TILE_SIZE, TILE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
}

async function detectContentCropWithin(buffer, outerCrop, imageProcessor) {
  const { data, info } = await imageProcessor(buffer)
    .extract(outerCrop)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const innerCrop = detectGeneratedContentCrop(data, info);
  return {
    left: outerCrop.left + innerCrop.left,
    top: outerCrop.top + innerCrop.top,
    width: innerCrop.width,
    height: innerCrop.height,
  };
}

function detectGeneratedContentCrop(data, info) {
  const lightBorderCrop = detectLightBorderCrop(data, info);
  return isFullImageCrop(lightBorderCrop, info)
    ? detectUniformDarkMatteCrop(data, info)
    : lightBorderCrop;
}

function isFullImageCrop(crop, info) {
  return crop.left === 0
    && crop.top === 0
    && crop.width === info.width
    && crop.height === info.height;
}

function detectUniformDarkMatteCrop(data, info) {
  const width = Math.max(1, Math.trunc(info?.width || 1));
  const height = Math.max(1, Math.trunc(info?.height || 1));
  const channels = Math.max(3, Math.trunc(info?.channels || 3));
  const fullCrop = { left: 0, top: 0, width, height };
  const maximumCropShare = 0.15;
  const maximumHorizontalCrop = Math.floor(width * maximumCropShare);
  const maximumVerticalCrop = Math.floor(height * maximumCropShare);
  const matteTolerance = 18;
  const requiredMatteShare = 0.96;
  const maximumInnerMatteShare = 0.72;
  const cornerSize = Math.max(1, Math.min(3, Math.floor(Math.min(width, height) / 8)));
  const cornerColors = [
    averageRegionColor(data, width, channels, 0, 0, cornerSize, cornerSize),
    averageRegionColor(data, width, channels, width - cornerSize, 0, cornerSize, cornerSize),
    averageRegionColor(data, width, channels, 0, height - cornerSize, cornerSize, cornerSize),
    averageRegionColor(data, width, channels, width - cornerSize, height - cornerSize, cornerSize, cornerSize),
  ];
  const matteColor = cornerColors.reduce(
    (total, color) => total.map((value, index) => value + color[index] / cornerColors.length),
    [0, 0, 0],
  );

  if (Math.max(...matteColor) > 120 || !cornerColors.every((color) => (
    color.every((value, index) => Math.abs(value - matteColor[index]) <= matteTolerance)
  ))) {
    return fullCrop;
  }

  const isMattePixel = (x, y) => {
    const offset = ((y * width) + x) * channels;
    return [0, 1, 2].every((channel) => (
      Math.abs(data[offset + channel] - matteColor[channel]) <= matteTolerance
    ));
  };
  const rowMatteShare = (y) => {
    let matches = 0;
    for (let x = 0; x < width; x += 1) matches += isMattePixel(x, y) ? 1 : 0;
    return matches / width;
  };
  const columnMatteShare = (x) => {
    let matches = 0;
    for (let y = 0; y < height; y += 1) matches += isMattePixel(x, y) ? 1 : 0;
    return matches / height;
  };
  const scanEdge = (maximum, getShare) => {
    let inset = 0;
    while (inset < maximum && getShare(inset) >= requiredMatteShare) inset += 1;
    return inset;
  };

  const top = scanEdge(maximumVerticalCrop, rowMatteShare);
  const bottomInset = scanEdge(maximumVerticalCrop, (inset) => rowMatteShare(height - 1 - inset));
  const left = scanEdge(maximumHorizontalCrop, columnMatteShare);
  const rightInset = scanEdge(maximumHorizontalCrop, (inset) => columnMatteShare(width - 1 - inset));
  const insets = [top, bottomInset, left, rightInset];

  if (insets.some((inset) => inset < 2)
    || Math.abs(top - bottomInset) > Math.max(2, Math.ceil(Math.max(top, bottomInset) * 0.25))
    || Math.abs(left - rightInset) > Math.max(2, Math.ceil(Math.max(left, rightInset) * 0.25))
    || rowMatteShare(top) > maximumInnerMatteShare
    || rowMatteShare(height - 1 - bottomInset) > maximumInnerMatteShare
    || columnMatteShare(left) > maximumInnerMatteShare
    || columnMatteShare(width - 1 - rightInset) > maximumInnerMatteShare) {
    return fullCrop;
  }

  return {
    left,
    top,
    width: width - left - rightInset,
    height: height - top - bottomInset,
  };
}

function averageRegionColor(data, imageWidth, channels, left, top, width, height) {
  const totals = [0, 0, 0];
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const offset = ((y * imageWidth) + x) * channels;
      for (let channel = 0; channel < 3; channel += 1) totals[channel] += data[offset + channel];
    }
  }
  const pixelCount = Math.max(1, width * height);
  return totals.map((total) => total / pixelCount);
}

function detectLightBorderCrop(data, info) {
  const width = Math.max(1, Math.trunc(info?.width || 1));
  const height = Math.max(1, Math.trunc(info?.height || 1));
  const channels = Math.max(3, Math.trunc(info?.channels || 3));
  const maxHorizontalCrop = Math.floor(width * 0.2);
  const maxVerticalCrop = Math.floor(height * 0.2);
  const requiredLightShare = 0.9;
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  const isLightPixel = (x, y) => {
    const offset = ((y * width) + x) * channels;
    return data[offset] >= 225 && data[offset + 1] >= 225 && data[offset + 2] >= 225;
  };
  const rowIsLight = (y, startX, endX) => {
    let lightPixels = 0;
    for (let x = startX; x <= endX; x += 1) {
      lightPixels += isLightPixel(x, y) ? 1 : 0;
    }
    return lightPixels / Math.max(1, endX - startX + 1) >= requiredLightShare;
  };
  const columnIsLight = (x, startY, endY) => {
    let lightPixels = 0;
    for (let y = startY; y <= endY; y += 1) {
      lightPixels += isLightPixel(x, y) ? 1 : 0;
    }
    return lightPixels / Math.max(1, endY - startY + 1) >= requiredLightShare;
  };

  while (top < maxVerticalCrop && top < bottom && rowIsLight(top, left, right)) top += 1;
  while ((height - 1 - bottom) < maxVerticalCrop && bottom > top && rowIsLight(bottom, left, right)) bottom -= 1;
  while (left < maxHorizontalCrop && left < right && columnIsLight(left, top, bottom)) left += 1;
  while ((width - 1 - right) < maxHorizontalCrop && right > left && columnIsLight(right, top, bottom)) right -= 1;

  const foundBorder = top > 0 || bottom < height - 1 || left > 0 || right < width - 1;
  if (foundBorder) {
    top = Math.min(bottom, top + (top > 0 ? 1 : 0));
    bottom = Math.max(top, bottom - (bottom < height - 1 ? 1 : 0));
    left = Math.min(right, left + (left > 0 ? 1 : 0));
    right = Math.max(left, right - (right < width - 1 ? 1 : 0));
  }

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
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
  if (["VISUAL_PLANNING_FAILED", "INVALID_VISUAL_PLAN", "INCOMPLETE_VISUAL_PLAN"].includes(error?.code)) {
    return "Die fachliche Bildplanung konnte nicht abgeschlossen werden. Es wurden keine neuen Bilder zugeordnet.";
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

function normalizeSetContext(value) {
  return {
    title: normalizeText(value?.title, 160),
    subject: normalizeText(value?.subject, 120),
    description: normalizeText(value?.description, 500),
    sourceLanguage: normalizeText(value?.sourceLanguage, 20) || "de",
    targetLanguage: normalizeText(value?.targetLanguage, 20) || "en",
    sourceLabel: normalizeText(value?.sourceLabel, 80) || "Deutsch",
    targetLabel: normalizeText(value?.targetLabel, 80) || "Englisch",
  };
}

function normalizeVisualBrief(value) {
  const cardId = normalizeId(value?.cardId);
  const intendedMeaning = normalizeText(value?.intendedMeaning, MAX_VISUAL_BRIEF_TEXT_LENGTH);
  const scene = normalizeText(value?.scene, MAX_VISUAL_BRIEF_TEXT_LENGTH);
  const avoid = Array.isArray(value?.avoid)
    ? value.avoid.map((entry) => normalizeText(entry, 300)).filter(Boolean).slice(0, 8)
    : [];
  const strategy = VISUAL_BRIEF_STRATEGIES.has(value?.strategy) ? value.strategy : "contextual";
  const confidence = VISUAL_BRIEF_CONFIDENCE.has(value?.confidence) ? value.confidence : "low";
  if (!cardId || !intendedMeaning || !scene || avoid.length === 0) {
    return null;
  }
  return { cardId, intendedMeaning, scene, avoid, strategy, confidence };
}

function normalizeTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function normalizePositiveInteger(value) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
  return normalized > 0 ? normalized : null;
}

function normalizeSheetIndex(value) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : -1;
  return normalized >= 0 && normalized < SHEET_CAPACITY
    ? normalized
    : null;
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
  buildSinglePrompt,
  buildVisualPlanningPrompt,
  buildVisualBriefSchema,
  normalizeGeneratedTile,
  normalizeGeneratedSheetTile,
  normalizeStoredSheetTile,
  normalizeAssetStore,
  normalizeJobStore,
};
