const crypto = require('node:crypto');
const path = require('node:path');
const { RuntimeJsonStore } = require('./runtime-json-store');

function shuffle(keys, last = '') {
  const result = [...keys];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === last) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
function cardKey(card) {
  const content = crypto.createHash('sha256').update(JSON.stringify([card.source.text.trim(), card.target.text.trim()])).digest('hex');
  return `${card.id || 'legacy'}:${content}`;
}
class SentenceOrderStore {
  constructor({ dataDir = '' } = {}) {
    this.memory = { version: 1, entries: {} };
    this.store = dataDir ? new RuntimeJsonStore(path.join(dataDir, 'sentence-order.json'), {
      defaultValue: this.memory,
      normalize: value => ({ version: 1, entries: value?.entries && typeof value.entries === 'object' && !Array.isArray(value.entries) ? value.entries : {} }),
    }) : null;
  }
  key(actor, setPath, direction) {
    return crypto.createHash('sha256').update(JSON.stringify([actor, setPath, direction])).digest('hex');
  }
  async prepare(actor, setPath, direction, keys, excluded = []) {
    const store = this.store ? await this.store.read() : this.memory;
    const key = this.key(actor, setPath, direction);
    const previous = store.entries[key];
    const known = Array.isArray(previous?.known) ? previous.known : [];
    let remaining = Array.isArray(previous?.remaining) ? [...new Set(previous.remaining)].filter(item => keys.includes(item)) : [];
    remaining.push(...shuffle(keys.filter(item => !known.includes(item))));
    if (!remaining.length) remaining = shuffle(keys, previous?.last);
    const selected = remaining.find(item => !excluded.includes(item));
    if (!selected) throw Object.assign(new Error('Durchgang ist nicht mehr aktuell. Bitte neu starten.'), { status: 410 });
    return { key, selected, entry: { actor, setPath, direction, known: keys, remaining: remaining.filter(item => item !== selected), last: selected, updatedAt: new Date().toISOString() } };
  }
  async commit(prepared) {
    const update = store => {
      // Bounded metadata only: discard entries unused for six months.
      const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
      for (const [key, entry] of Object.entries(store.entries)) if (!entry || !Number.isFinite(Date.parse(entry.updatedAt)) || Date.parse(entry.updatedAt) < cutoff) delete store.entries[key];
      if (!store.entries[prepared.key] && Object.keys(store.entries).length >= 10000) throw Object.assign(new Error('Bitte später erneut versuchen.'), { status: 503 });
      store.entries[prepared.key] = prepared.entry;
    };
    if (this.store) await this.store.mutate(update);
    else update(this.memory);
  }
  async remove(actor, setPath = '') {
    const remove = store => {
      for (const [key, entry] of Object.entries(store.entries)) if ((!actor || entry.actor === actor) && (!setPath || entry.setPath === setPath)) delete store.entries[key];
    };
    if (this.store) await this.store.mutate(remove);
    else remove(this.memory);
  }
}
module.exports = { SentenceOrderStore, cardKey };
