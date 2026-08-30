const crypto = require("crypto");
const path = require("path");
const { RuntimeJsonStore } = require("./runtime-json-store");

const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_SET_CARDS = 500;

function normalizeSetStore(value) {
  return {
    version: 1,
    sets: Array.isArray(value?.sets)
      ? value.sets.map((entry) => normalizeStoredSet(entry)).filter(Boolean)
      : [],
  };
}

function normalizeStoredSet(entry) {
  const id = normalizeId(entry?.id);
  const ownerTeacherId = normalizeId(entry?.ownerTeacherId);
  const title = normalizeText(entry?.title, 160);
  const status = entry?.status === "archived"
    ? "archived"
    : entry?.status === "draft"
      ? "draft"
      : "published";

  if (!id || !ownerTeacherId || (status !== "draft" && !title)) {
    return null;
  }

  return {
    id,
    ownerTeacherId,
    path: normalizeSetPath(entry?.path),
    title,
    subject: normalizeText(entry?.subject, 120),
    description: normalizeText(entry?.description, 500),
    sourceLanguage: normalizeLanguageCode(entry?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(entry?.targetLanguage, "en"),
    sourceLabel: normalizeText(entry?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(entry?.targetLabel, 80) || "Übersetzung oder Definition",
    shareCode: normalizeShareCode(entry?.shareCode),
    status,
    revision: Number.isFinite(entry?.revision) ? Math.max(1, Math.trunc(entry.revision)) : 1,
    cards: status === "draft"
      ? normalizeDraftCards(Array.isArray(entry?.cards) ? entry.cards.slice(0, MAX_SET_CARDS) : [])
      : normalizeStoredCards(entry?.cards),
    createdAt: normalizeTimestamp(entry?.createdAt),
    updatedAt: normalizeTimestamp(entry?.updatedAt),
    publishedAt: normalizeTimestamp(entry?.publishedAt),
    archivedAt: normalizeTimestamp(entry?.archivedAt),
  };
}

function normalizeStoredCards(value) {
  return Array.isArray(value)
    ? value.slice(0, MAX_SET_CARDS).map((entry) => {
        const front = normalizeText(entry?.front, 500);
        const back = normalizeText(entry?.back, 1000);
        if (!front || !back) {
          return null;
        }

        const acceptedAnswers = normalizeAcceptedAnswers(entry?.acceptedAnswers, back);
        return {
          id: normalizeId(entry?.id) || createCardId(),
          front,
          back,
          acceptedAnswers,
          presentation: normalizeCardPresentation(entry?.presentation),
          visual: normalizeCardVisual(entry?.visual),
        };
      }).filter(Boolean)
    : [];
}

class SetService {
  constructor({ dataDir }) {
    this.store = new RuntimeJsonStore(path.join(dataDir, "teacher-sets.json"), {
      defaultValue: { version: 1, sets: [] },
      normalize: normalizeSetStore,
    });
  }

  async listOwnedSets(teacherId) {
    const normalizedTeacherId = normalizeId(teacherId);
    const store = await this.store.read();
    return store.sets
      .filter((entry) => entry.ownerTeacherId === normalizedTeacherId && entry.status !== "archived")
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map((entry) => this.toTeacherSetEntry(entry));
  }

  async listPublishedEntries() {
    const store = await this.store.read();
    return store.sets
      .filter((entry) => entry.status === "published")
      .map((entry) => this.toPublicSetEntry(entry));
  }

  async getOwnedSet(teacherId, setId) {
    const store = await this.store.read();
    const setEntry = store.sets.find((entry) => (
      entry.id === normalizeId(setId)
      && entry.ownerTeacherId === normalizeId(teacherId)
      && entry.status !== "archived"
    ));

    return setEntry ? this.toEditableSet(setEntry) : null;
  }

  async createSet(teacherId, input) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedInput = normalizeSetInput(input);

    return this.store.mutate((store) => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const setEntry = {
        id,
        ownerTeacherId: normalizedTeacherId,
        ...normalizedInput,
        shareCode: createUniqueShareCode(store.sets),
        status: "published",
        revision: 1,
        cards: normalizedInput.cards.map((card) => ({
          ...card,
          id: createCardId(),
        })),
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        archivedAt: null,
      };

      store.sets.push(setEntry);
      return this.toEditableSet(setEntry);
    });
  }

  async createDraft(teacherId, input) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedInput = normalizeDraftInput(input);

    if (!normalizedTeacherId) {
      throw createSetError("Ungültiger Set-Eigentümer.", 500, "INVALID_SET_OWNER");
    }
    if (!hasMeaningfulDraftContent(normalizedInput)) {
      throw createSetError("Der Entwurf ist noch leer.", 400, "DRAFT_EMPTY");
    }

    return this.store.mutate((store) => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const setEntry = {
        id,
        ownerTeacherId: normalizedTeacherId,
        ...normalizedInput,
        shareCode: "",
        status: "draft",
        revision: 1,
        cards: normalizedInput.cards.map((card) => ({
          ...card,
          id: createCardId(),
        })),
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        archivedAt: null,
      };

      store.sets.push(setEntry);
      return this.toEditableSet(setEntry);
    });
  }

  async ensureOwnedSeedSets(teacherId, seedSets) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSeeds = Array.isArray(seedSets)
      ? seedSets.map((entry) => normalizeOwnedSeedSet(entry)).filter(Boolean)
      : [];

    if (!normalizedTeacherId) {
      throw createSetError("Ungültiger Set-Eigentümer.", 500, "INVALID_SET_OWNER");
    }

    return this.store.mutate((store) => {
      let added = 0;

      for (const seed of normalizedSeeds) {
        const existing = store.sets.find((entry) => entry.id === seed.id || entry.path === seed.path);
        if (existing) {
          if (existing.id !== seed.id || existing.path !== seed.path || existing.ownerTeacherId !== normalizedTeacherId) {
            throw createSetError(
              `Set-Seed kollidiert mit einem vorhandenen Set: ${seed.id}`,
              500,
              "SET_SEED_COLLISION",
            );
          }
          continue;
        }

        const now = new Date().toISOString();
        store.sets.push({
          ...seed,
          ownerTeacherId: normalizedTeacherId,
          shareCode: createUniqueShareCode(store.sets),
          status: "published",
          revision: seed.revision || 1,
          createdAt: seed.createdAt || now,
          updatedAt: seed.updatedAt || seed.createdAt || now,
          publishedAt: seed.publishedAt || seed.createdAt || now,
          archivedAt: null,
        });
        added += 1;
      }

      return {
        added,
        total: store.sets.filter((entry) => (
          entry.ownerTeacherId === normalizedTeacherId
          && normalizedSeeds.some((seed) => seed.id === entry.id && seed.path === entry.path)
        )).length,
      };
    });
  }

  async updateSet(teacherId, setId, input) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const normalizedInput = normalizeSetInput(input);

    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => (
        entry.id === normalizedSetId
        && entry.ownerTeacherId === normalizedTeacherId
        && entry.status !== "archived"
      ));

      if (!setEntry) {
        throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      }

      const previousCardsById = new Map(setEntry.cards.map((card) => [card.id, card]));
      const nextCards = normalizedInput.cards.map((card) => {
        const previousCard = card.id ? previousCardsById.get(card.id) : null;
        if (previousCard && hasSameCardContent(previousCard, card)) {
          return {
            ...previousCard,
            ...card,
            id: previousCard.id,
          };
        }

        return {
          ...card,
          id: createCardId(),
        };
      });

      const wasDraft = setEntry.status === "draft";
      const now = new Date().toISOString();
      Object.assign(setEntry, normalizedInput, {
        cards: nextCards,
        status: "published",
        shareCode: setEntry.shareCode || createUniqueShareCode(store.sets),
        revision: setEntry.revision + 1,
        updatedAt: now,
        publishedAt: wasDraft ? now : setEntry.publishedAt,
      });

      return this.toEditableSet(setEntry);
    });
  }

  async updateDraft(teacherId, setId, input) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const normalizedInput = normalizeDraftInput(input);

    if (!hasMeaningfulDraftContent(normalizedInput)) {
      throw createSetError("Der Entwurf ist noch leer.", 400, "DRAFT_EMPTY");
    }

    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => (
        entry.id === normalizedSetId
        && entry.ownerTeacherId === normalizedTeacherId
        && entry.status !== "archived"
      ));

      if (!setEntry) {
        throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      }
      if (setEntry.status !== "draft") {
        throw createSetError("Veröffentlichte Sets werden bewusst gespeichert.", 409, "SET_NOT_DRAFT");
      }

      const previousCardsById = new Map(setEntry.cards.map((card) => [card.id, card]));
      const nextCards = normalizedInput.cards.map((card) => {
        const previousCard = card.id ? previousCardsById.get(card.id) : null;
        return {
          ...card,
          id: previousCard?.id || createCardId(),
        };
      });

      Object.assign(setEntry, normalizedInput, {
        cards: nextCards,
        revision: setEntry.revision + 1,
        updatedAt: new Date().toISOString(),
      });

      return this.toEditableSet(setEntry);
    });
  }

  async deleteOwnedSet(teacherId, setId) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);

    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => (
        entry.id === normalizedSetId
        && entry.ownerTeacherId === normalizedTeacherId
        && entry.status !== "archived"
      ));

      if (!setEntry) {
        throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      }

      const now = new Date().toISOString();
      setEntry.status = "archived";
      setEntry.updatedAt = now;
      setEntry.archivedAt = now;
      return this.toTeacherSetEntry(setEntry);
    });
  }

  async assignCardVisuals(teacherId, setId, assignments) {
    const normalizedTeacherId = normalizeId(teacherId);
    const normalizedSetId = normalizeId(setId);
    const normalizedAssignments = Array.isArray(assignments)
      ? assignments.map((entry) => ({
          cardId: normalizeId(entry?.cardId),
          contentHash: normalizeText(entry?.contentHash, 128),
          visual: normalizeCardVisual(entry?.visual),
        })).filter((entry) => entry.cardId && entry.visual)
      : [];

    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => (
        entry.id === normalizedSetId
        && entry.ownerTeacherId === normalizedTeacherId
        && entry.status === "published"
      ));
      if (!setEntry) {
        throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      }

      const cardsById = new Map(setEntry.cards.map((card) => [card.id, card]));
      const attachedCardIds = [];
      const skippedCardIds = [];
      for (const assignment of normalizedAssignments) {
        const card = cardsById.get(assignment.cardId);
        if (!card || (assignment.contentHash && createCardContentHash(card) !== assignment.contentHash)) {
          skippedCardIds.push(assignment.cardId);
          continue;
        }
        card.visual = assignment.visual;
        attachedCardIds.push(card.id);
      }

      if (attachedCardIds.length > 0) {
        setEntry.revision += 1;
        setEntry.updatedAt = new Date().toISOString();
      }
      return { attachedCardIds, skippedCardIds, set: this.toEditableSet(setEntry) };
    });
  }

  async findPublishedSetById(setId) {
    const store = await this.store.read();
    const setEntry = store.sets.find((entry) => (
      entry.id === normalizeId(setId)
      && entry.status === "published"
    ));
    return setEntry || null;
  }

  async findPublishedSetByPath(setPath) {
    const normalizedPath = normalizeSetPath(setPath);
    if (!normalizedPath) {
      return null;
    }

    const store = await this.store.read();
    const exactMatch = store.sets.find((entry) => (
      entry.path === normalizedPath
      && entry.status === "published"
    ));
    if (exactMatch) {
      return exactMatch;
    }

    const match = normalizedPath
      ? normalizedPath.match(/^sets\/user\/([a-f0-9-]+)\.json$/i)
      : null;
    return match ? this.findPublishedSetById(match[1]) : null;
  }

  async resolveShareCode(shareCode) {
    const normalizedCode = normalizeShareCode(shareCode);
    if (!normalizedCode) {
      return null;
    }

    const store = await this.store.read();
    const setEntry = store.sets.find((entry) => (
      entry.shareCode === normalizedCode
      && entry.status === "published"
    ));
    return setEntry ? this.toPublicSetEntry(setEntry) : null;
  }

  toTeacherSetEntry(setEntry) {
    return {
      ...this.toPublicSetEntry(setEntry),
      editable: true,
      status: setEntry.status,
      ownerTeacherId: setEntry.ownerTeacherId,
      sourceLabel: setEntry.sourceLabel,
      targetLabel: setEntry.targetLabel,
      sourceLanguage: setEntry.sourceLanguage,
      targetLanguage: setEntry.targetLanguage,
      revision: setEntry.revision,
      updatedAt: setEntry.updatedAt,
    };
  }

  toPublicSetEntry(setEntry) {
    return {
      id: setEntry.id,
      path: setEntry.path || buildSetPath(setEntry.id),
      title: setEntry.title || "Unbenanntes Set",
      subject: setEntry.subject,
      description: setEntry.description,
      category: "Meine Sets",
      cardCount: setEntry.cards.length,
      shareCode: setEntry.shareCode,
    };
  }

  toEditableSet(setEntry) {
    return {
      ...this.toTeacherSetEntry(setEntry),
      title: setEntry.title,
      cards: setEntry.cards.map((card) => ({
        ...card,
        ...(card.visual ? { visual: toCardVisualDocument(card.visual) } : {}),
      })),
    };
  }

  toSetDocument(setEntry) {
    return {
      schemaVersion: "1.2",
      set: {
        id: setEntry.id,
        slug: setEntry.id,
        title: setEntry.title,
        subject: setEntry.subject,
        description: setEntry.description,
        languages: {
          source: setEntry.sourceLanguage,
          target: setEntry.targetLanguage,
        },
        labels: {
          source: setEntry.sourceLabel,
          target: setEntry.targetLabel,
        },
        defaultDirections: {
          flashcard: "source_to_target",
          test: "source_to_target",
        },
        tags: [],
        createdAt: setEntry.createdAt,
        updatedAt: setEntry.updatedAt,
        revision: setEntry.revision,
      },
      settings: {
        enabledModes: ["flashcard", "test"],
        starLevels: [
          { value: 0, label: "none", color: "none" },
          { value: 1, label: "easy", color: "green" },
          { value: 2, label: "medium", color: "yellow" },
          { value: 3, label: "hard", color: "orange" },
        ],
      },
      cards: setEntry.cards.map((card) => {
        const presentation = card.presentation || {};
        return {
          id: card.id,
          source: { text: card.front },
          target: { text: card.back },
          examples: presentation.examples || [{
            id: "answer",
            source: card.front,
            target: card.back,
          }],
          hintData: presentation.hintData || {
            flashcard: {
              exampleId: "answer",
              maskedWord: maskAnswer(card.back),
              firstLetterHint: revealFirstLetter(card.back),
            },
          },
          acceptedAnswers: card.acceptedAnswers,
          meta: presentation.meta || {
            tags: [],
            active: true,
          },
          ...(presentation.audio ? { audio: presentation.audio } : {}),
          ...(card.visual ? { visual: toCardVisualDocument(card.visual) } : {}),
        };
      }),
    };
  }
}

function normalizeOwnedSeedSet(value) {
  const id = normalizeId(value?.id);
  const pathValue = normalizeSetPath(value?.path);
  const title = normalizeText(value?.title, 160);
  const cards = normalizeStoredCards(value?.cards);

  if (!id || !pathValue || !title || cards.length === 0) {
    return null;
  }

  return {
    id,
    path: pathValue,
    title,
    subject: normalizeText(value?.subject, 120),
    description: normalizeText(value?.description, 500),
    sourceLanguage: normalizeLanguageCode(value?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(value?.targetLanguage, "en"),
    sourceLabel: normalizeText(value?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(value?.targetLabel, 80) || "Übersetzung oder Definition",
    revision: Number.isFinite(value?.revision) ? Math.max(1, Math.trunc(value.revision)) : 1,
    cards,
    createdAt: normalizeTimestamp(value?.createdAt),
    updatedAt: normalizeTimestamp(value?.updatedAt),
    publishedAt: normalizeTimestamp(value?.publishedAt),
  };
}

function normalizeCardPresentation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const presentation = {};
  for (const key of ["examples", "hintData", "meta", "audio"]) {
    if (value[key] !== undefined) {
      presentation[key] = cloneJsonValue(value[key]);
    }
  }

  return Object.keys(presentation).length > 0 ? presentation : null;
}

function normalizeCardVisual(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const assetId = normalizeId(value.assetId);
  if (!assetId) {
    return null;
  }
  return {
    assetId,
    width: Number.isFinite(value.width) ? Math.max(1, Math.trunc(value.width)) : 512,
    height: Number.isFinite(value.height) ? Math.max(1, Math.trunc(value.height)) : 512,
    alt: normalizeText(value.alt, 300),
    createdAt: normalizeTimestamp(value.createdAt),
  };
}

function toCardVisualDocument(visual) {
  return {
    ...visual,
    url: `/media/visuals/${encodeURIComponent(visual.assetId)}.webp`,
  };
}

function cloneJsonValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return null;
  }
}

function maskAnswer(value) {
  return Array.from(String(value || ""), (character) => (
    /[\p{L}\p{N}]/u.test(character) ? "_" : character
  )).join("");
}

function revealFirstLetter(value) {
  let hasRevealedLetter = false;
  return Array.from(String(value || ""), (character) => {
    if (!/[\p{L}\p{N}]/u.test(character)) {
      return character;
    }
    if (!hasRevealedLetter) {
      hasRevealedLetter = true;
      return character;
    }
    return "_";
  }).join("");
}

function normalizeSetInput(value) {
  const title = normalizeText(value?.title, 160);
  const cards = normalizeInputCards(value?.cards);

  if (!title) {
    throw createSetError("Titel fehlt.", 400, "TITLE_REQUIRED");
  }

  if (cards.length === 0) {
    throw createSetError("Mindestens eine vollständige Karte ist erforderlich.", 400, "CARDS_REQUIRED");
  }

  return {
    title,
    subject: normalizeText(value?.subject, 120),
    description: normalizeText(value?.description, 500),
    sourceLanguage: normalizeLanguageCode(value?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(value?.targetLanguage, "en"),
    sourceLabel: normalizeText(value?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(value?.targetLabel, 80) || "Übersetzung oder Definition",
    cards,
  };
}

function normalizeDraftInput(value) {
  return {
    title: normalizeText(value?.title, 160),
    subject: normalizeText(value?.subject, 120),
    description: normalizeText(value?.description, 500),
    sourceLanguage: normalizeLanguageCode(value?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(value?.targetLanguage, "en"),
    sourceLabel: normalizeText(value?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(value?.targetLabel, 80) || "Übersetzung oder Definition",
    cards: normalizeDraftCards(value?.cards),
  };
}

function normalizeDraftCards(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length > MAX_SET_CARDS) {
    throw createSetError(`Ein Set darf höchstens ${MAX_SET_CARDS} Karten enthalten.`, 400, "TOO_MANY_CARDS");
  }

  return value.map((entry) => {
    const front = normalizeText(entry?.front, 500);
    const back = normalizeText(entry?.back, 1000);
    if (!front && !back) {
      return null;
    }
    return {
      id: normalizeId(entry?.id),
      front,
      back,
      acceptedAnswers: normalizeAcceptedAnswers(entry?.acceptedAnswers, back),
      presentation: normalizeCardPresentation(entry?.presentation),
    };
  }).filter(Boolean);
}

function hasMeaningfulDraftContent(value) {
  return Boolean(value.title || value.subject || value.description || value.cards.length > 0);
}

function normalizeInputCards(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > MAX_SET_CARDS) {
    throw createSetError(`Ein Set darf höchstens ${MAX_SET_CARDS} Karten enthalten.`, 400, "TOO_MANY_CARDS");
  }

  return value.map((entry) => {
    const front = normalizeText(entry?.front, 500);
    const back = normalizeText(entry?.back, 1000);
    if (!front || !back) {
      return null;
    }

    return {
      id: normalizeId(entry?.id),
      front,
      back,
      acceptedAnswers: normalizeAcceptedAnswers(entry?.acceptedAnswers, back),
    };
  }).filter(Boolean);
}

function normalizeAcceptedAnswers(value, fallback) {
  const answers = Array.isArray(value)
    ? value.map((entry) => normalizeText(entry, 500)).filter(Boolean)
    : [];
  const uniqueAnswers = [...new Set([normalizeText(fallback, 500), ...answers].filter(Boolean))];
  return uniqueAnswers.slice(0, 20);
}

function hasSameCardContent(left, right) {
  return left.front === right.front
    && left.back === right.back
    && JSON.stringify(left.acceptedAnswers) === JSON.stringify(right.acceptedAnswers);
}

function createCardContentHash(card) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      front: normalizeText(card?.front, 500),
      back: normalizeText(card?.back, 1000),
      acceptedAnswers: normalizeAcceptedAnswers(card?.acceptedAnswers, card?.back),
    }))
    .digest("hex");
}

function createUniqueShareCode(existingSets) {
  const usedCodes = new Set(existingSets.map((entry) => entry.shareCode).filter(Boolean));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    while (code.length < 6) {
      const byte = crypto.randomBytes(1)[0];
      code += SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length];
    }

    if (!usedCodes.has(code)) {
      return code;
    }
  }

  throw createSetError("Set-Code konnte nicht erzeugt werden.", 500, "SHARE_CODE_FAILED");
}

function createCardId() {
  return `c_${crypto.randomUUID()}`;
}

function buildSetPath(setId) {
  return `sets/user/${setId}.json`;
}

function normalizeSetPath(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    !normalized.startsWith("sets/")
    || !normalized.endsWith(".json")
    || normalized.startsWith("/")
    || normalized.includes("\\")
    || normalized.includes("?")
    || normalized.includes("#")
  ) {
    return "";
  }

  return normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ? ""
    : normalized;
}

function normalizeId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]{0,127}$/.test(normalized) || /^[a-f0-9-]{36}$/.test(normalized)
    ? normalized
    : "";
}

function normalizeShareCode(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "") : "";
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalized) ? normalized : "";
}

function normalizeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeLanguageCode(value, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : fallback;
}

function normalizeTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function createSetError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = {
  SetService,
  buildSetPath,
  createCardContentHash,
  normalizeSetInput,
  normalizeSetStore,
};
