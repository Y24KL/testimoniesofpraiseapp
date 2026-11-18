/**
 * Account-wide concurrency gate for Praxiom chat. Praxiom allows 2 chat requests in progress per account,
 * across every caller, so the count must live in one place: a single Durable Object shared by all Worker
 * instances. Each request takes a lease with an expiry, so a crashed Worker cannot hold a slot forever.
 *
 * Without the PRAXIOM_GATE binding (local tests, or before the binding is deployed) the gate falls back to a
 * counter inside one isolate. That still stops one isolate from exceeding the limit, but not several.
 */
import { AIEndpointError } from './ai.js';
import { applyLeaseAction, invalidLeaseRequest } from './praxiomPolicy.js';

export const PRAXIOM_CHAT_LIMIT = 2;
export const GATE_LEASE_MS = 40000; // longer than the 25 s Praxiom timeout, so a live request keeps its slot
export const GATE_WAIT_MS = 6000; // how long a caller waits for a free slot before it is told to try again
const POLL_MS = 250;
const GATE_OBJECT_NAME = 'praxiom-account';
const LEASES_KEY = 'leases';

let warnedLocal = false;
const localState = { leases: {} };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Durable Object. Its storage holds { leases: { leaseId: expiresAtMs } }. */
export class PraxiomConcurrencyGate {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }
    const problem = invalidLeaseRequest(body);
    if (problem) return json({ error: 'invalid_lease', field: problem }, 400);
    const leases = (await this.state.storage.get(LEASES_KEY)) || {};
    const result = applyLeaseAction(leases, body.action, body, Date.now());
    await this.state.storage.put(LEASES_KEY, result.leases);
    return json({ granted: result.granted, inFlight: result.inFlight });
  }
}

async function gateCall(env, body) {
  const namespace = env.PRAXIOM_GATE;
  if (namespace && typeof namespace.idFromName === 'function' && typeof namespace.get === 'function') {
    const stub = namespace.get(namespace.idFromName(GATE_OBJECT_NAME));
    const response = await stub.fetch('https://praxiom-gate.internal/lease', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new AIEndpointError(503, 'gate_unavailable', 'The assistant is temporarily unavailable. Please try again shortly.');
    return response.json();
  }
  if (!warnedLocal) {
    warnedLocal = true;
    console.warn('[praxiom] PRAXIOM_GATE is not bound; concurrency is limited per isolate only');
  }
  const result = applyLeaseAction(localState.leases, body.action, body, Date.now());
  localState.leases = result.leases;
  return { granted: result.granted, inFlight: result.inFlight };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for a free chat slot, then returns { release }. Call release in a finally block.
 * Throws a 429 the app already understands if no slot frees up within GATE_WAIT_MS.
 */
export async function acquireChatSlot(env, leaseId, { limit = PRAXIOM_CHAT_LIMIT, waitMs = GATE_WAIT_MS, ttlMs = GATE_LEASE_MS, sleep = defaultSleep } = {}) {
  const started = Date.now();
  for (;;) {
    const result = await gateCall(env, { action: 'acquire', leaseId, limit, ttlMs });
    if (result.granted) {
      return {
        release: async () => {
          try {
            await gateCall(env, { action: 'release', leaseId });
          } catch {
            /* the lease expires on its own */
          }
        },
      };
    }
    if (Date.now() - started >= waitMs) {
      const error = new AIEndpointError(429, 'provider_rate_limit', 'The assistant is busy. Please wait a moment and try again.');
      error.providerCode = 'gate_busy';
      throw error;
    }
    await sleep(POLL_MS);
  }
}

/** Test helper: resets the in-isolate fallback. Not used by the app. */
export function resetLocalGateForTests() {
  localState.leases = {};
  warnedLocal = false;
}
