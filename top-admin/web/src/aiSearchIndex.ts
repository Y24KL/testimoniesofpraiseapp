import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  vector,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || 'https://top-push-relay.gtrusouth116.workers.dev').replace(/\/$/, '');
const PAGE_SIZE = 150;
const BATCH_SIZE = 16;

interface SearchIndexRecord {
  id: string;
  title: string;
  description?: string;
  authorName?: string;
  category?: string;
  keywords?: string[];
}

function textFor(record: SearchIndexRecord): string {
  return [record.title, record.description, record.authorName, record.category, ...(record.keywords ?? [])]
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n')
    .slice(0, 3000);
}

async function requestEmbeddings(texts: string[]): Promise<number[][]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to the admin portal before building the AI search index.');
  const token = await user.getIdToken();
  let lastError = 'Could not generate search embeddings.';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${WORKER_URL}/api/ai/index-content`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(payload.embeddings)) {
      return payload.embeddings as number[][];
    }
    lastError = typeof payload.error === 'string' ? payload.error : lastError;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(lastError);
}

export async function indexTestimony(record: SearchIndexRecord): Promise<void> {
  const embeddingText = textFor(record);
  if (!record.id || !record.title?.trim() || !embeddingText) return;
  const [embedding] = await requestEmbeddings([embeddingText]);
  if (!Array.isArray(embedding) || embedding.length !== 1024) {
    throw new Error('The embedding model returned an unexpected vector size. Expected 1024 dimensions.');
  }
  await updateDoc(doc(db, 'testimonies', record.id), {
    isPublished: true,
    aiEmbedding: vector(embedding),
    aiEmbeddingModel: '@cf/baai/bge-m3',
    aiEmbeddingDimensions: embedding.length,
    aiEmbeddingUpdatedAt: serverTimestamp(),
  });
}

export async function reindexPublishedTestimonies(onProgress?: (indexed: number, scanned: number) => void) {
  let cursor: QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let indexed = 0;
  while (true) {
    const base = query(collection(db, 'testimonies'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const pageQuery = cursor ? query(collection(db, 'testimonies'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE)) : base;
    const snapshot = await getDocs(pageQuery);
    if (snapshot.empty) break;
    scanned += snapshot.size;
    const published = snapshot.docs.flatMap((item) => {
      const data = item.data();
      const isPublished = data.isPublished === true || data.published === true;
      if (!isPublished || typeof data.title !== 'string' || !data.title.trim()) return [];
      return [{
        id: item.id,
        ref: item.ref,
        record: {
          id: item.id,
          title: data.title,
          description: typeof data.description === 'string' ? data.description : '',
          authorName: typeof data.authorName === 'string' ? data.authorName : '',
          category: typeof data.category === 'string' ? data.category : '',
          keywords: Array.isArray(data.keywords) ? data.keywords.filter((x: unknown): x is string => typeof x === 'string') : [],
        },
      }];
    });

    for (let i = 0; i < published.length; i += BATCH_SIZE) {
      const batch = published.slice(i, i + BATCH_SIZE);
      const embeddings = await requestEmbeddings(batch.map((item) => textFor(item.record)));
      if (embeddings.length !== batch.length || embeddings.some((v) => !Array.isArray(v) || v.length !== 1024)) {
        throw new Error('The embedding service returned vectors with unexpected dimensions.');
      }
      await Promise.all(batch.map((item, j) => updateDoc(item.ref, {
        // Normalise legacy published:true records so the client-side security-filtered vector query works.
        isPublished: true,
        aiEmbedding: vector(embeddings[j]),
        aiEmbeddingModel: '@cf/baai/bge-m3',
        aiEmbeddingDimensions: embeddings[j].length,
        aiEmbeddingUpdatedAt: serverTimestamp(),
      })));
      indexed += batch.length;
      onProgress?.(indexed, scanned);
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }
  return { indexed, scanned };
}
