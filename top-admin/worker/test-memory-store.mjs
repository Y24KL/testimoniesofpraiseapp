/** In-memory store with the same contract as src/notify/firestoreStore.js (preconditions, versions, atomic commits), for tests. */
// ---------------- in-memory store (same contract as createFirestoreStore) ----------------
export function memoryStore(initial = {}) {
  const docs = new Map();
  let clock = 0;
  const ver = () => `v${++clock}`;
  for (const [path, data] of Object.entries(initial)) docs.set(path, { data: structuredClone(data), version: ver() });
  const inCol = (col) => [...docs.entries()].filter(([p]) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes('/')).map(([p, d]) => ({ id: p.slice(col.length + 1), data: structuredClone(d.data), version: d.version }));
  const setPath = (o, path, v) => { const ks = path.split('.'); let x = o; for (const k of ks.slice(0, -1)) x = x[k] = x[k] && typeof x[k] === 'object' ? x[k] : {}; x[ks.at(-1)] = v; };
  const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const delPath = (o, path) => { const ks = path.split('.'); const p = ks.slice(0, -1).reduce((x, k) => (x == null ? undefined : x[k]), o); if (p) delete p[ks.at(-1)]; };
  const precondition = (w) => {
    const cur = docs.get(`${w.col}/${w.id}`);
    if (w.kind === 'create' || w.ifVersion === null) return !cur;
    if (typeof w.ifVersion === 'string') return cur?.version === w.ifVersion;
    if (w.kind === 'update') return Boolean(cur);
    return true;
  };
  const apply = (w) => {
    const key = `${w.col}/${w.id}`;
    if (w.kind === 'delete') { docs.delete(key); return { ok: true }; }
    let data = w.kind === 'create' || w.kind === 'set' ? structuredClone(w.data || {}) : structuredClone(docs.get(key)?.data || {});
    if (w.kind !== 'create' && w.kind !== 'set') for (const [k, v] of Object.entries(w.data || {})) setPath(data, k, structuredClone(v));
    for (const r of w.remove || []) delPath(data, r);
    for (const [k, n] of Object.entries(w.inc || {})) setPath(data, k, (Number(getPath(data, k)) || 0) + n);
    const version = ver();
    docs.set(key, { data, version });
    return { ok: true, version };
  };
  return {
    docs,
    doc: (path) => docs.get(path)?.data ?? null,
    col: inCol,
    async get(col, ids) {
      return new Map(ids.map((id) => { const d = docs.get(`${col}/${id}`); return [id, d ? { id, data: structuredClone(d.data), version: d.version } : null]; }));
    },
    async dueQuery(col, field, max, limit) {
      return inCol(col).filter((d) => typeof d.data[field] === 'number' && d.data[field] <= max).sort((a, b) => a.data[field] - b.data[field]).slice(0, limit);
    },
    async getPaths(paths) {
      return new Map(paths.map((p) => { const d = docs.get(p); return [p, d ? { id: p.split('/').pop(), data: structuredClone(d.data), version: d.version } : null]; }));
    },
    async whereIn(col, field, values) {
      return inCol(col).filter((d) => values.includes(d.data[field]));
    },
    async pageById(col, afterId, limit) {
      return inCol(col).sort((a, b) => (a.id < b.id ? -1 : 1)).filter((d) => !afterId || d.id > afterId).slice(0, limit);
    },
    async commit(writes, atomic) {
      if (atomic) {
        if (!writes.every(precondition)) return writes.map(() => ({ ok: false }));
        return writes.map(apply);
      }
      return writes.map((w) => (precondition(w) ? apply(w) : { ok: false }));
    },
  };
}

