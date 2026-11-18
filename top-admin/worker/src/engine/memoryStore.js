/**
 * In-memory implementation of the engine's store interface (see firestoreRest.js). Used by the tests, so the
 * engine can be run end to end without any network. It follows the same rules: create is atomic, update needs
 * an existing document, and writeMany applies its operations together.
 */

const clone = (v) => (v instanceof Date ? new Date(v.getTime()) : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const getField = (data, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);
const comparable = (v) => (v instanceof Date ? v.getTime() : v);

function matches(data, filter) {
  const actual = comparable(getField(data, filter.field));
  const wanted = comparable(filter.value);
  switch (filter.op) {
    case 'EQUAL': return actual === wanted;
    case 'GREATER_THAN': return actual !== undefined && actual > wanted;
    case 'GREATER_THAN_OR_EQUAL': return actual !== undefined && actual >= wanted;
    case 'LESS_THAN': return actual !== undefined && actual < wanted;
    default: throw new Error(`Unsupported op ${filter.op}`);
  }
}

export class MemoryStore {
  constructor(initial = {}) {
    this.docs = new Map();
    for (const [path, data] of Object.entries(initial)) this.docs.set(path, clone(data));
    this.writes = 0;
  }

  async get(path) {
    return this.docs.has(path) ? clone(this.docs.get(path)) : null;
  }

  async set(path, data, { merge = false } = {}) {
    this.writes += 1;
    const next = merge && this.docs.has(path) ? { ...this.docs.get(path), ...clone(data) } : clone(data);
    this.docs.set(path, next);
  }

  async create(path, data) {
    if (this.docs.has(path)) return false;
    this.writes += 1;
    this.docs.set(path, clone(data));
    return true;
  }

  async update(path, data) {
    if (!this.docs.has(path)) throw new Error(`No document ${path}`);
    this.writes += 1;
    this.docs.set(path, { ...this.docs.get(path), ...clone(data) });
  }

  async delete(path) {
    this.writes += 1;
    this.docs.delete(path);
  }

  async writeMany(ops) {
    for (const op of ops) {
      if (op.op === 'delete') await this.delete(op.path);
      else await this.set(op.path, op.data, { merge: op.merge });
    }
  }

  async query({ collection, filters = [], orderBy = [], limit = 100 }) {
    const prefix = `${collection}/`;
    let rows = [];
    for (const [path, data] of this.docs) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
      if (filters.every((f) => matches(data, f))) rows.push({ id: path.slice(prefix.length), data: clone(data) });
    }
    for (const o of [...orderBy].reverse()) {
      const dir = o.direction === 'DESCENDING' ? -1 : 1;
      rows.sort((a, b) => {
        const x = comparable(getField(a.data, o.field));
        const y = comparable(getField(b.data, o.field));
        return x === y ? 0 : (x < y ? -1 : 1) * dir;
      });
    }
    return rows.slice(0, limit);
  }
}
