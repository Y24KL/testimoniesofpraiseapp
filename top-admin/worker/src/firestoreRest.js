/**
 * Minimal Firestore REST client for the notification engine (server only). It implements the store
 * interface that the engine uses, so tests can substitute memoryStore.js:
 *
 *   get(path) -> data | null
 *   set(path, data, { merge })         replace, or merge fields
 *   create(path, data) -> boolean      only if the document does not exist yet (atomic)
 *   update(path, data)                 merge fields; the document must exist
 *   delete(path)
 *   query({ collection, filters, orderBy, limit }) -> [{ id, data }]
 *   writeMany(ops)                     atomic batch of { op: 'set'|'delete', path, data, merge }
 *
 * Dates are written as Firestore timestamps and read back as Date objects.
 */
import { FIRESTORE_SCOPE, getGoogleAccessToken } from './googleAuth.js';

const MAX_BATCH = 400;

/** Encodes a JS value as a Firestore REST value. */
export function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Cannot encode ${typeof value}`);
}

export function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeValue(v)]));
}

/** Decodes a Firestore REST value into a JS value. */
export function decodeValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

export function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

const idOf = (name) => decodeURIComponent(name.split('/').pop());

export class FirestoreRest {
  /**
   * serviceAccount: the FIREBASE_SERVICE_ACCOUNT secret. projectId: the Firebase project id.
   * fetchFn and tokenFn are injectable for tests.
   */
  constructor({ serviceAccount, projectId, fetchFn = fetch, tokenFn = getGoogleAccessToken }) {
    if (!projectId) throw new Error('projectId is required');
    this.serviceAccount = serviceAccount;
    this.projectId = projectId;
    this.fetchFn = fetchFn;
    this.tokenFn = tokenFn;
    this.root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)`;
    this.documents = `${this.root}/documents`;
  }

  async request(url, init = {}) {
    const token = await this.tokenFn(this.serviceAccount, FIRESTORE_SCOPE, { fetchFn: this.fetchFn });
    const response = await this.fetchFn(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    return response;
  }

  /** Document resource name, with each path segment URL-safe. */
  docUrl(path) {
    return `${this.documents}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  docName(path) {
    return `projects/${this.projectId}/databases/(default)/documents/${path}`;
  }

  async get(path) {
    const response = await this.request(this.docUrl(path));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore get failed (${response.status})`);
    const doc = await response.json();
    return decodeFields(doc.fields || {});
  }

  async set(path, data, { merge = false } = {}) {
    await this.writeMany([{ op: 'set', path, data, merge }]);
  }

  async update(path, data) {
    await this.commit([this.writeFor({ op: 'set', path, data, merge: true, mustExist: true })]);
  }

  async delete(path) {
    await this.commit([{ delete: this.docName(path) }]);
  }

  async create(path, data) {
    const response = await this.request(`${this.root}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: [{ update: { name: this.docName(path), fields: encodeFields(data) }, currentDocument: { exists: false } }] }),
    });
    if (response.ok) return true;
    const text = await response.text().catch(() => '');
    if (response.status === 409 || text.includes('FAILED_PRECONDITION') || text.includes('ALREADY_EXISTS')) return false;
    throw new Error(`Firestore create failed (${response.status})`);
  }

  writeFor({ op, path, data = {}, merge = false, mustExist = false }) {
    if (op === 'delete') return { delete: this.docName(path) };
    const write = { update: { name: this.docName(path), fields: encodeFields(data) } };
    if (merge) write.updateMask = { fieldPaths: Object.keys(data).filter((k) => data[k] !== undefined) };
    if (mustExist) write.currentDocument = { exists: true };
    return write;
  }

  async commit(writes) {
    const response = await this.request(`${this.root}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[firestore] commit failed', response.status, text.slice(0, 200));
      throw new Error(`Firestore commit failed (${response.status})`);
    }
  }

  async writeMany(ops) {
    for (let i = 0; i < ops.length; i += MAX_BATCH) {
      await this.commit(ops.slice(i, i + MAX_BATCH).map((op) => this.writeFor(op)));
    }
  }

  async query({ collection, filters = [], orderBy = [], limit = 100 }) {
    const structuredQuery = { from: [{ collectionId: collection }], limit };
    if (filters.length) {
      const fieldFilters = filters.map((f) => ({
        fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: encodeValue(f.value) },
      }));
      structuredQuery.where = fieldFilters.length === 1 ? fieldFilters[0] : { compositeFilter: { op: 'AND', filters: fieldFilters } };
    }
    if (orderBy.length) structuredQuery.orderBy = orderBy.map((o) => ({ field: { fieldPath: o.field }, direction: o.direction || 'ASCENDING' }));
    const response = await this.request(`${this.documents}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
    if (!response.ok) throw new Error(`Firestore query failed (${response.status})`);
    const rows = await response.json();
    return rows.filter((r) => r.document).map((r) => ({ id: idOf(r.document.name), data: decodeFields(r.document.fields || {}) }));
  }
}
