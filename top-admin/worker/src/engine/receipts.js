/**
 * Reads Expo delivery receipts for sent notifications and records the outcome per person. A receipt that
 * reports DeviceNotRegistered removes that device's token. Only the first receipts are read per run.
 */
import { EXPO_RECEIPTS_URL } from './send.js';

export const RECEIPT_BATCH = 300;

export async function checkReceipts(store, { fetchFn = fetch, expoUrl = EXPO_RECEIPTS_URL, now }) {
  const rows = await store.query({
    collection: 'notification_deliveries',
    filters: [
      { field: 'status', op: 'EQUAL', value: 'sent' },
      { field: 'receiptChecked', op: 'EQUAL', value: false },
    ],
    limit: RECEIPT_BATCH,
  });
  const pairs = rows.flatMap((r) => (r.data.tickets || []).map((t) => ({ ...t, deliveryId: r.id })));
  const summary = { checked: 0, delivered: 0, errors: 0, removed: 0 };
  if (pairs.length === 0) return summary;

  let response;
  try {
    response = await fetchFn(expoUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pairs.map((p) => p.ticketId) }),
    });
  } catch {
    return summary; // try again on the next run
  }
  if (!response.ok) return summary;
  const data = (await response.json().catch(() => ({})))?.data || {};

  // A delivery is recorded only when every one of its tickets has a receipt. Otherwise it is read next run.
  const grouped = new Map();
  for (const p of pairs) {
    if (!grouped.has(p.deliveryId)) grouped.set(p.deliveryId, []);
    grouped.get(p.deliveryId).push(p);
  }
  const byDelivery = new Map();
  for (const [deliveryId, list] of grouped) {
    if (list.some((p) => !data[p.ticketId])) continue;
    const outcome = { ok: true, dead: [] };
    for (const p of list) {
      const receipt = data[p.ticketId];
      if (receipt.status !== 'ok') {
        outcome.ok = false;
        if (receipt.details?.error === 'DeviceNotRegistered') outcome.dead.push(p.docId);
      }
    }
    byDelivery.set(deliveryId, outcome);
  }

  for (const [deliveryId, outcome] of byDelivery) {
    summary.checked += 1;
    if (outcome.ok) summary.delivered += 1;
    else summary.errors += 1;
    await store.update(`notification_deliveries/${deliveryId}`, {
      receiptChecked: true,
      receiptStatus: outcome.ok ? 'delivered' : 'error',
      receiptAt: new Date(now),
    });
    for (const docId of outcome.dead) {
      await store.delete(`pushTokens/${docId}`);
      summary.removed += 1;
    }
  }
  return summary;
}
