const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SetService } = require("../lib/set-service");

const input = { title: "Shops", sidePreset: "languages", sourceLabel: "Englisch", targetLabel: "Deutsch", sourceLanguage: "en", targetLanguage: "de", cards: [{ front: "a shop", back: "ein Geschäft" }] };
async function isolated(run) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-units-"));
  try { await run(new SetService({ dataDir }), dataDir); }
  finally { await fs.rm(dataDir, { recursive: true, force: true }); }
}

test("legacy sets migrate to unfiled without changing their published identities", () => isolated(async (service, dataDir) => {
  const created = await service.createSet("aksana", input);
  const original = await service.getOwnedSet("aksana", created.id);
  const file = path.join(dataDir, "teacher-sets.json");
  const legacy = JSON.parse(await fs.readFile(file, "utf8"));
  legacy.version = 1; delete legacy.units; delete legacy.sets[0].unitId;
  await fs.writeFile(file, JSON.stringify(legacy));
  assert.deepEqual(await service.listUnits("aksana"), []);
  const migrated = await service.getOwnedSet("aksana", original.id);
  assert.deepEqual(migrated, original);
  await service.saveUnit("aksana", { name: "BL3 · Unit 1" });
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).version, 4);
}));

test("units persist per owner and refuse foreign IDs and duplicate names", () => isolated(async (service, dataDir) => {
  const unit = await service.saveUnit("aksana", { name: " BL3 · Unit 1 " });
  assert.equal(unit.name, "BL3 · Unit 1");
  assert.deepEqual(await new SetService({ dataDir }).listUnits("aksana"), [unit]);
  assert.deepEqual(await service.listUnits("julius"), []);
  await assert.rejects(service.saveUnit("aksana", { name: "bl3 · unit 1" }), { code: "UNIT_NAME_EXISTS" });
  await assert.rejects(service.saveUnit("aksana", { name: "x".repeat(81) }), { code: "UNIT_NAME_REQUIRED" });
  await assert.rejects(service.saveUnit("julius", { name: "Renamed" }, unit.id), { code: "UNIT_NOT_FOUND" });
  await assert.rejects(service.deleteUnit("julius", unit.id), { code: "UNIT_NOT_FOUND" });
  await assert.rejects(service.createDraft("julius", { title: "Draft", unitId: unit.id }), { code: "INVALID_UNIT" });
  const renamed = await service.saveUnit("aksana", { name: "BL3 · Unit 2" }, unit.id);
  assert.equal(renamed.id, unit.id);
}));

test("moving sets and removing a unit leave cards, codes, revisions and ordering unchanged", () => isolated(async (service) => {
  const unit = await service.saveUnit("aksana", { name: "BL3 · Unit 1" });
  const created = await service.createSet("aksana", input);
  const original = await service.getOwnedSet("aksana", created.id);
  const moved = await service.moveSet("aksana", original.id, unit.id);
  assert.deepEqual(moved, { ...original, unitId: unit.id });
  assert.equal((await service.toSetDocument((await service.store.read()).sets[0])).set.unitId, undefined);
  await assert.rejects(service.moveSet("julius", original.id, ""), { code: "SET_NOT_FOUND" });
  const otherUnit = await service.saveUnit("julius", { name: "Own Unit" });
  await assert.rejects(service.moveSet("aksana", original.id, otherUnit.id), { code: "INVALID_UNIT" });
  await assert.rejects(service.moveSet("aksana", original.id, undefined), { code: "INVALID_UNIT" });
  await service.deleteUnit("aksana", unit.id);
  assert.deepEqual(await service.getOwnedSet("aksana", original.id), original);
  assert.deepEqual(await service.listUnits("julius"), [otherUnit]);
}));

test("a new set inherits its unit and content saves preserve organization without accepting a forged reassignment", () => isolated(async (service) => {
  const unit = await service.saveUnit("aksana", { name: "BL3 · Unit 1" });
  const draft = await service.createDraft("aksana", { title: "Draft", unitId: unit.id, cards: [{ front: "a shop", back: "" }] });
  assert.equal(draft.unitId, unit.id);
  const updated = await service.updateDraft("aksana", draft.id, { title: "Draft again", cards: draft.cards, unitId: "forged" });
  assert.equal(updated.unitId, unit.id);
  const published = await service.updateSet("aksana", draft.id, { ...input, cards: [{ ...draft.cards[0], back: "ein Geschäft" }], unitId: "forged" });
  assert.equal(published.unitId, unit.id);
  const resaved = await service.updateSet("aksana", draft.id, { ...input, cards: published.cards });
  assert.equal(resaved.cards[0].id, published.cards[0].id);
  assert.equal(resaved.shareCode, published.shareCode);
  assert.equal(resaved.unitId, unit.id);
}));


test("library order persists independently of content, folder assignment and the public list", () => isolated(async (service, dataDir) => {
  const a = await service.saveUnit("aksana", { name: "A" });
  const b = await service.saveUnit("aksana", { name: "B" });
  const first = await service.createSet("aksana", { ...input, title: "First", unitId: a.id });
  const second = await service.createSet("aksana", { ...input, title: "Second", unitId: b.id });
  const third = await service.createSet("aksana", { ...input, title: "Third", unitId: a.id });
  const publicBefore = await service.listPublishedEntries();
  await service.reorderLibrary("aksana", { kind: "sets", id: third.id, beforeId: first.id });
  assert.deepEqual((await service.listOwnedSets("aksana")).map(s => s.id), [third.id, first.id, second.id]);
  assert.deepEqual(await service.getOwnedSet("aksana", first.id), { ...first, libraryOrder: 1 });
  await service.updateSet("aksana", second.id, { ...second, title: "Second edited", libraryOrder: 0 });
  await service.moveSet("aksana", third.id, b.id);
  const reopened = new SetService({ dataDir });
  assert.deepEqual((await reopened.listOwnedSets("aksana")).map(s => s.id), [third.id, first.id, second.id]);
  assert.deepEqual((await reopened.listPublishedEntries()).map(s => s.id), publicBefore.map(s => s.id));
  await service.reorderLibrary("aksana", { kind: "units", id: b.id, beforeId: a.id });
  await service.saveUnit("aksana", { name: "Z" }, b.id);
  assert.deepEqual((await reopened.listUnits("aksana")).map(u => u.id), [b.id, a.id]);
  const fresh = await service.createSet("aksana", input);
  assert.equal((await reopened.listOwnedSets("aksana")).at(-1).id, fresh.id);
}));

test("library reordering rejects foreign, missing and archived anchors without writes", () => isolated(async (service, dataDir) => {
  const own = await service.createSet("aksana", input);
  const foreign = await service.createSet("julius", input);
  const file = path.join(dataDir, "teacher-sets.json");
  const before = await fs.readFile(file, "utf8");
  for (const args of [
    ["julius", { kind: "sets", id: own.id, beforeId: null }],
    ["aksana", { kind: "sets", id: own.id, beforeId: foreign.id }],
    ["aksana", { kind: "sets", id: own.id }],
    ["aksana", { kind: "unknown", id: own.id, beforeId: null }],
  ]) await assert.rejects(service.reorderLibrary(...args));
  assert.equal(await fs.readFile(file, "utf8"), before);
  await service.deleteOwnedSet("aksana", own.id);
  await assert.rejects(service.reorderLibrary("aksana", { kind: "sets", id: own.id, beforeId: null }), { code: "LIBRARY_ENTRY_NOT_FOUND" });
}));

test("version 3 adopts the existing teacher order once and keeps physical public ordering", () => isolated(async (service, dataDir) => {
  const a = await service.saveUnit("aksana", { name: "Z" });
  const b = await service.saveUnit("aksana", { name: "A" });
  const old = await service.createSet("aksana", { ...input, title: "Old" });
  const recent = await service.createSet("aksana", { ...input, title: "Recent" });
  const file = path.join(dataDir, "teacher-sets.json");
  const legacy = JSON.parse(await fs.readFile(file, "utf8")); legacy.version = 3;
  legacy.units.forEach(u => { delete u.libraryOrder; });
  legacy.sets.forEach(s => { delete s.libraryOrder; s.updatedAt = s.id === old.id ? "2026-01-01T00:00:00.000Z" : "2026-02-01T00:00:00.000Z"; });
  await fs.writeFile(file, JSON.stringify(legacy));
  assert.deepEqual((await service.listOwnedSets("aksana")).map(s => s.id), [recent.id, old.id]);
  assert.deepEqual((await service.listUnits("aksana")).map(u => u.id), [b.id, a.id]);
  await service.reorderLibrary("aksana", { kind: "sets", id: old.id, beforeId: recent.id });
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).version, 4);
  assert.deepEqual((await service.listPublishedEntries()).map(s => s.id), [old.id, recent.id]);
}));
