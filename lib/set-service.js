const crypto = require("crypto");
const path = require("path");
const { RuntimeJsonStore } = require("./runtime-json-store");
const setSides = require("../set-side-options");

const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_SET_CARDS = 500;

function normalizeSetStore(value) {
  const units = Array.isArray(value?.units) ? value.units.map((entry) => ({
    id: normalizeId(entry?.id),
    ownerTeacherId: normalizeId(entry?.ownerTeacherId),
    name: normalizeText(entry?.name, 80),
    libraryOrder: normalizeLibraryOrder(entry?.libraryOrder),
  })).filter((entry, index, all) => entry.id && entry.ownerTeacherId && entry.name
    && all.findIndex((candidate) => candidate.id === entry.id) === index) : [];
  const sets = Array.isArray(value?.sets)
    ? value.sets.map((entry) => normalizeStoredSet(entry)).filter(Boolean) : [];
  for (const setEntry of sets) {
    if (!units.some((unit) => unit.id === setEntry.unitId && unit.ownerTeacherId === setEntry.ownerTeacherId)) {
      setEntry.unitId = "";
    }
  }
  fillLibraryOrder(units, (a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  fillLibraryOrder(sets, (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {
    version: 4,
    units,
    sets,
  };
}

function normalizeLibraryOrder(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function compareLibraryOrder(a, b) {
  return a.libraryOrder - b.libraryOrder || a.id.localeCompare(b.id);
}

function nextLibraryOrder(entries, ownerTeacherId) {
  return entries.filter((entry) => entry.ownerTeacherId === ownerTeacherId)
    .reduce((next, entry) => Math.max(next, (entry.libraryOrder ?? -1) + 1), 0);
}

function fillLibraryOrder(entries, legacyCompare) {
  for (const owner of new Set(entries.map((entry) => entry.ownerTeacherId))) {
    let next = nextLibraryOrder(entries, owner);
    for (const entry of entries.filter((entry) => entry.ownerTeacherId === owner && entry.libraryOrder === null).sort(legacyCompare)) {
      entry.libraryOrder = next++;
    }
  }
}

function reorderOwnedEntries(entries, teacherId, id, beforeId) {
  const own = entries.filter((entry) => entry.ownerTeacherId === normalizeId(teacherId) && entry.status !== "archived").sort(compareLibraryOrder);
  const moved = own.find((entry) => entry.id === id);
  if (!moved) throw createSetError("Eintrag nicht gefunden.", 404, "LIBRARY_ENTRY_NOT_FOUND");
  if (beforeId !== null && (typeof beforeId !== "string" || !own.some((entry) => entry.id === beforeId))) {
    throw createSetError("Die Zielposition ist nicht mehr verfügbar. Bitte die Bibliothek aktualisieren.", 409, "INVALID_LIBRARY_ORDER");
  }
  if (beforeId !== id) {
    own.splice(own.indexOf(moved), 1);
    own.splice(beforeId === null ? own.length : own.findIndex((entry) => entry.id === beforeId), 0, moved);
    own.forEach((entry, index) => { entry.libraryOrder = index; });
  }
  return own;
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

  if (!id || !ownerTeacherId) {
    return null;
  }

  return {
    id,
    ownerTeacherId,
    unitId: normalizeId(entry?.unitId),
    libraryOrder: normalizeLibraryOrder(entry?.libraryOrder),
    path: normalizeSetPath(entry?.path),
    title,
    subject: normalizeText(entry?.subject, 120),
    description: normalizeText(entry?.description, 500),
    sourceLanguage: normalizeLanguageCode(entry?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(entry?.targetLanguage, "en"),
    sourceLabel: normalizeText(entry?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(entry?.targetLabel, 80) || "Übersetzung oder Definition",
    sidePreset: normalizeSidePreset(entry?.sidePreset),
    sideSelection: normalizeSideSelection(entry?.sideSelection),
    contentRevision: Number.isFinite(entry?.contentRevision) ? Math.max(1, Math.trunc(entry.contentRevision)) : 1,
    shareCode: normalizeShareCode(entry?.shareCode),
    status,
    revision: Number.isFinite(entry?.revision) ? Math.max(1, Math.trunc(entry.revision)) : 1,
    cards: (Array.isArray(entry?.cards) ? entry.cards.slice(0, MAX_SET_CARDS) : []).flatMap((raw) => normalizeDraftCards([raw]).map((card) => ({
      ...card, id: card.id || createCardId(), visual: normalizeCardVisual(raw.visual),
    }))),
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
      defaultValue: { version: 4, units: [], sets: [] },
      normalize: normalizeSetStore,
    });
  }

  async listUnits(teacherId = "") {
    const store = await this.store.read();
    return store.units.filter((unit) => !teacherId || unit.ownerTeacherId === normalizeId(teacherId))
      .sort(compareLibraryOrder);
  }

  async saveUnit(teacherId, input, unitId = "") {
    const ownerTeacherId = normalizeId(teacherId);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!ownerTeacherId || !name || name.length > 80) {
      throw createSetError("Bitte einen Lerndeck-Namen mit höchstens 80 Zeichen eingeben.", 400, "UNIT_NAME_REQUIRED");
    }
    return this.store.mutate((store) => {
      const existing = unitId ? store.units.find((unit) => unit.id === normalizeId(unitId) && unit.ownerTeacherId === ownerTeacherId) : null;
      if (unitId && !existing) throw createSetError("Lerndeck nicht gefunden.", 404, "UNIT_NOT_FOUND");
      if (store.units.some((unit) => unit.ownerTeacherId === ownerTeacherId && unit.id !== existing?.id
        && unit.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de"))) {
        throw createSetError("Ein Lerndeck mit diesem Namen existiert bereits.", 409, "UNIT_NAME_EXISTS");
      }
      if (existing) existing.name = name;
      const unit = existing || { id: crypto.randomUUID(), ownerTeacherId, name, libraryOrder: nextLibraryOrder(store.units, ownerTeacherId) };
      if (!existing) store.units.push(unit);
      return { ...unit };
    });
  }

  async deleteUnit(teacherId, unitId) {
    return this.store.mutate((store) => {
      const index = store.units.findIndex((unit) => unit.id === normalizeId(unitId) && unit.ownerTeacherId === normalizeId(teacherId));
      if (index < 0) throw createSetError("Lerndeck nicht gefunden.", 404, "UNIT_NOT_FOUND");
      const [unit] = store.units.splice(index, 1);
      for (const setEntry of store.sets) {
        if (setEntry.ownerTeacherId === unit.ownerTeacherId && setEntry.unitId === unit.id) setEntry.unitId = "";
      }
      return unit;
    });
  }

  async moveSet(teacherId, setId, unitId) {
    if (typeof unitId !== "string") throw createSetError("Bitte ein Lerndeck oder Nicht eingeordnet auswählen.", 400, "INVALID_UNIT");
    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => entry.id === normalizeId(setId)
        && entry.ownerTeacherId === normalizeId(teacherId) && entry.status !== "archived");
      if (!setEntry) throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      setEntry.unitId = requireOwnedUnit(store, teacherId, unitId);
      return this.toEditableSet(setEntry);
    });
  }

  async reorderLibrary(teacherId, input) {
    const { kind, id, beforeId } = input || {};
    if (!["sets", "units"].includes(kind)) throw createSetError("Ungültige Bibliotheksliste.", 400, "INVALID_LIBRARY_ORDER");
    return this.store.mutate((store) => ({
      kind,
      items: reorderOwnedEntries(store[kind], teacherId, id, beforeId)
        .map((entry) => ({ id: entry.id, libraryOrder: entry.libraryOrder })),
    }));
  }

  async listOwnedSets(teacherId) {
    const normalizedTeacherId = normalizeId(teacherId);
    const store = await this.store.read();
    return store.sets
      .filter((entry) => entry.ownerTeacherId === normalizedTeacherId && entry.status !== "archived")
      .sort(compareLibraryOrder)
      .map((entry) => this.toTeacherSetEntry(entry));
  }

  async listManageableSets() {
    const store = await this.store.read();
    return store.sets
      .filter((entry) => entry.status !== "archived")
      .sort(compareLibraryOrder)
      .map((entry) => this.toTeacherSetEntry(entry));
  }

  async getSetOwnerId(setId) {
    const store = await this.store.read();
    const setEntry = store.sets.find((entry) => (
      entry.id === normalizeId(setId)
      && entry.status !== "archived"
    ));
    return setEntry?.ownerTeacherId || null;
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
    const normalizedInput = normalizeEditableInput(input);
    if (!normalizedTeacherId) throw createSetError("Ungültiger Set-Eigentümer.", 500, "INVALID_SET_OWNER");

    return this.store.mutate((store) => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const setEntry = {
        id,
        ownerTeacherId: normalizedTeacherId,
        unitId: requireOwnedUnit(store, normalizedTeacherId, input?.unitId),
        libraryOrder: nextLibraryOrder(store.sets, normalizedTeacherId),
        ...normalizedInput,
        shareCode: createUniqueShareCode(store.sets),
        status: "published",
        contentRevision: 1,
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

  // Compatibility endpoints share the same lifecycle as ordinary sets.
  async createDraft(teacherId, input) {
    return this.createSet(teacherId, input);
  }

  async migrateAutosaveSets() {
    return this.store.mutate((store) => {
      for (const entry of store.sets) {
        if (entry.status !== "draft") continue;
        entry.status = "published";
        entry.shareCode ||= createUniqueShareCode(store.sets);
        entry.sideSelection ||= setSides.infer(entry)
          ? { front: setSides.infer(entry).front, back: setSides.infer(entry).back }
          : { front: "", back: "" };
        entry.publishedAt ||= entry.updatedAt;
      }
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

    return this.store.mutate((store) => {
      const setEntry = store.sets.find((entry) => (
        entry.id === normalizedSetId
        && entry.ownerTeacherId === normalizedTeacherId
        && entry.status !== "archived"
      ));

      if (!setEntry) {
        throw createSetError("Set nicht gefunden.", 404, "SET_NOT_FOUND");
      }
      if (input?.expectedContentRevision !== undefined && input.expectedContentRevision !== setEntry.contentRevision) {
        throw createSetError("Dieses Set wurde in einer anderen Ansicht geändert. Deine Eingaben bleiben hier erhalten. Bitte die andere Ansicht schließen und die Änderungen vergleichen.", 409, "SET_CONTENT_CONFLICT");
      }
      const merged = { ...setEntry, ...input };
      if (input?.sideSelection === undefined && input?.sidePreset) {
        const inferred = setSides.infer(merged);
        requireSideConfiguration(merged);
        merged.sideSelection = { front: inferred.front, back: inferred.back };
      }
      const normalizedInput = normalizeEditableInput(merged);

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
        contentRevision: setEntry.contentRevision + 1,
        updatedAt: now,
        publishedAt: wasDraft ? now : setEntry.publishedAt,
      });

      return this.toEditableSet(setEntry);
    });
  }

  async updateDraft(teacherId, setId, input) {
    return this.updateSet(teacherId, setId, input);
  }

  learningCards(setEntry) {
    if (setEntry.sideSelection && !setSides.resolve(setEntry.sideSelection.front, setEntry.sideSelection.back)) return [];
    return setEntry.cards.filter((card) => card.front.trim() && card.back.trim());
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
      unitId: setEntry.unitId || "",
      libraryOrder: setEntry.libraryOrder,
      sourceLabel: setEntry.sourceLabel,
      targetLabel: setEntry.targetLabel,
      sourceLanguage: setEntry.sourceLanguage,
      targetLanguage: setEntry.targetLanguage,
      sidePreset: setEntry.sidePreset,
      sideSelection: setEntry.sideSelection,
      contentRevision: setEntry.contentRevision,
      cardCount: setEntry.cards.length,
      learningCardCount: this.learningCards(setEntry).length,
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
      cardCount: this.learningCards(setEntry).length,
      shareCode: setEntry.shareCode,
    };
  }

  toEditableSet(setEntry) {
    return {
      ...this.toTeacherSetEntry(setEntry),
      title: setEntry.title,
      cards: setEntry.cards.map((card) => ({
        ...card,
        presentation: card.presentation || null,
        visual: card.visual ? toCardVisualDocument(card.visual) : null,
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
      },
      cards: this.learningCards(setEntry).map((card) => {
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
          visual: card.visual ? toCardVisualDocument(card.visual) : null,
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
    sidePreset: normalizeSidePreset(value?.sidePreset),
    cards,
  };
}

function requireOwnedUnit(store, teacherId, unitId) {
  if (unitId === undefined || unitId === null || unitId === "") return "";
  const id = normalizeId(unitId);
  if (!id || !store.units.some((unit) => unit.id === id && unit.ownerTeacherId === normalizeId(teacherId))) {
    throw createSetError("Dieses Lerndeck gehört nicht zu deiner Bibliothek.", 400, "INVALID_UNIT");
  }
  return id;
}

function normalizeSideSelection(value) {
  if (!value || typeof value !== "object") return null;
  return {
    front: setSides.choices[value.front] ? value.front : "",
    back: setSides.choices[value.back] ? value.back : "",
  };
}

function normalizeEditableInput(value) {
  if (value?.cards !== undefined && (!Array.isArray(value.cards)
    || value.cards.some(card => !card || typeof card !== "object" || Array.isArray(card)))) {
    throw createSetError("Vokabeln müssen als Kartenliste übergeben werden.", 400, "INVALID_CARDS");
  }
  if (value?.sideSelection && ["front", "back"].some(side => value.sideSelection[side] && !setSides.choices[value.sideSelection[side]])) {
    throw createSetError("Ungültige Seitenauswahl.", 400, "SIDE_CONFIGURATION_REQUIRED");
  }
  const selection = normalizeSideSelection(value?.sideSelection);
  const configuration = selection ? setSides.resolve(selection.front, selection.back) : null;
  if (selection?.front && selection?.back && !configuration) {
    throw createSetError("Vorder- und Rückseite müssen zusammenpassen.", 400, "SIDE_CONFIGURATION_REQUIRED");
  }
  const result = {
    title: normalizeText(value?.title, 160),
    subject: normalizeText(value?.subject, 120),
    description: normalizeText(value?.description, 500),
    sourceLanguage: normalizeLanguageCode(value?.sourceLanguage, "de"),
    targetLanguage: normalizeLanguageCode(value?.targetLanguage, "en"),
    sourceLabel: normalizeText(value?.sourceLabel, 80) || "Begriff",
    targetLabel: normalizeText(value?.targetLabel, 80) || "Übersetzung oder Definition",
    sidePreset: normalizeSidePreset(value?.sidePreset),
    sideSelection: selection,
    cards: normalizeDraftCards(value?.cards).map(({ presentation, ...card }) => card),
  };
  if (selection) {
    result.sidePreset = configuration?.preset || null;
    if (configuration) Object.assign(result, configuration);
  } else if (result.sidePreset) {
    requireSideConfiguration(result);
  } else if (!value?.id) {
    result.sideSelection = { front: "", back: "" };
  }
  return result;
}

function normalizeSidePreset(value) {
  return ["languages", "term-definition", "question-answer"].includes(value) ? value : null;
}

function requireSideConfiguration(input) {
  const matched = setSides.infer(input);
  if (!matched || matched.preset !== input.sidePreset) {
    throw createSetError("Vorder- und Rückseite müssen passend ausgewählt werden.", 400, "SIDE_CONFIGURATION_REQUIRED");
  }
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
    if (!front && !back && !normalizeId(entry?.id)) {
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
