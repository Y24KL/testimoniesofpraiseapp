/**
 * Clip search: finds the moment in a testimony video that matches a question ("a cat", "the pastor prays").
 * The question is embedded with the same Gemini model the indexer used for the clips (1024 dimensions),
 * then Firestore's findNearest runs with the signed-in user's own token, so the security rules apply.
 */
import { AIEndpointError, enforceAiRateLimit, validateSearchQuery } from './ai.js';

const GEMINI = 'https://generativelanguage.googleapis.com';
const EMBED_MODEL = 'models/gemini-embedding-001';
const DIMENSIONS = 1024;

async function embedQuery(env, text) {
  if (!env.GEMINI_API_KEY) throw new AIEndpointError(503, 'clip_search_not_configured', 'Video moment search is not available yet.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${GEMINI}/v1beta/${EMBED_MODEL}:embedContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: DIMENSIONS,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    const values = data?.embedding?.values;
    if (!response.ok || !Array.isArray(values) || values.length !== DIMENSIONS) {
      throw new AIEndpointError(502, 'embedding_failed', 'Video moment search is temporarily unavailable.');
    }
    return values;
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    throw new AIEndpointError(502, 'embedding_failed', 'Video moment search is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

/** Returns { clips: [{ testimonyId, title, startSec, endSec, startLabel, description }] }. */
export async function searchClips(env, authorization, uid, question, limit = 6) {
  const query = validateSearchQuery(question);
  await enforceAiRateLimit(env, uid, 'clip-search', 25);
  const vector = await embedQuery(env, query);

  const structuredQuery = {
    from: [{ collectionId: 'testimonyClips' }],
    where: { fieldFilter: { field: { fieldPath: 'isPublished' }, op: 'EQUAL', value: { booleanValue: true } } },
    findNearest: {
      vectorField: { fieldPath: 'embedding' },
      queryVector: { arrayValue: { values: vector.map((n) => ({ doubleValue: n })) } },
      distanceMeasure: 'COSINE',
      limit: Math.max(1, Math.min(10, Number.isInteger(limit) ? limit : 6)),
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AIEndpointError(403, 'firestore_search_denied', 'You do not have permission to search this content.');
      }
      throw new AIEndpointError(503, 'clip_index_unavailable', 'The video moment index is not ready yet.');
    }
    const clips = (Array.isArray(payload) ? payload : []).flatMap((entry) => {
      const f = entry?.document?.fields;
      if (!f || f.isPublished?.booleanValue !== true) return [];
      const testimonyId = f.testimonyId?.stringValue;
      const startSec = Number(f.startSec?.integerValue ?? f.startSec?.doubleValue);
      if (!testimonyId || !Number.isFinite(startSec)) return [];
      return [{
        testimonyId,
        title: String(f.title?.stringValue ?? '').slice(0, 200),
        startSec,
        endSec: Number(f.endSec?.integerValue ?? f.endSec?.doubleValue ?? startSec),
        startLabel: String(f.startLabel?.stringValue ?? ''),
        description: String(f.description?.stringValue ?? '').slice(0, 300),
      }];
    });
    return { clips };
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === 'AbortError') throw new AIEndpointError(504, 'clip_search_timeout', 'Video moment search timed out. Please try again.');
    throw new AIEndpointError(502, 'clip_search_failed', 'Video moment search is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}
