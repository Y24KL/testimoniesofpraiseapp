/**
 * Praxiom Cloud client (see https://cloud.praxiomai.io/docs). OpenAI-compatible chat completions.
 *  - The key is the Worker secret PRAXIOM_API_KEY and is only ever sent to cloud.praxiomai.io.
 *  - Errors are mapped to the app's own messages. There is no fallback to another AI provider.
 *  - Message content, replies and keys are never logged. Only status codes and error codes are.
 */
import { AIEndpointError } from './ai.js';

export const PRAXIOM_BASE_URL = 'https://cloud.praxiomai.io/v1';
export const PRAXIOM_MODEL = 'praxiom';
export const PRAXIOM_TIMEOUT_MS = 25000;

/** Maps a Praxiom error response to the error the app shows. The body is read only for its error code. */
export async function praxiomError(response) {
  let code = '';
  try {
    code = (await response.json())?.error?.code || '';
  } catch {
    code = '';
  }
  const status = response.status;
  console.error('[praxiom] HTTP', status, code);

  if (status === 402 || code === 'insufficient_credit') {
    return new AIEndpointError(503, 'provider_balance', 'The assistant is out of AI credit. Please tell the administrator.');
  }
  if (status === 401 || code === 'invalid_api_key') {
    return new AIEndpointError(502, 'provider_auth_error', 'The assistant key needs checking. Please tell the administrator.');
  }
  if (status === 429) {
    return new AIEndpointError(429, 'provider_rate_limit', 'The assistant is busy. Please wait a moment and try again.');
  }
  if (status === 503 || code === 'model_unavailable') {
    return new AIEndpointError(503, 'provider_unavailable', 'The assistant is temporarily unavailable. Please try again shortly.');
  }
  if (status === 400 && code === 'context_length_exceeded') {
    return new AIEndpointError(400, 'context_too_long', 'That conversation is too long. Please start a new chat.');
  }
  if (status === 400) {
    return new AIEndpointError(400, 'provider_request_error', 'The assistant could not read that request. Please rephrase and try again.');
  }
  return new AIEndpointError(502, 'provider_error', `The assistant could not complete this request (code ${status}).`);
}

/** POST to /chat/completions with a timeout. Returns the fetch response (not yet read). */
export async function postChat(env, body, { fetchFn = fetch, signal } = {}) {
  if (!env.PRAXIOM_API_KEY) {
    throw new AIEndpointError(503, 'assistant_not_configured', 'The assistant is not available right now.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRAXIOM_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetchFn(`${PRAXIOM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.PRAXIOM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: PRAXIOM_MODEL }),
      signal: controller.signal,
    });
    if (!response.ok) throw await praxiomError(response);
    return response;
  } catch (error) {
    if (error instanceof AIEndpointError) throw error;
    if (error?.name === 'AbortError') {
      throw new AIEndpointError(504, 'provider_timeout', 'The assistant took too long. Please try again.');
    }
    throw new AIEndpointError(502, 'provider_unavailable', 'The assistant is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One non-streaming chat turn. Returns the assistant message (text and any tool calls) and the token usage
 * that Praxiom reports, so the caller can record it.
 */
export async function praxiomChat(env, { messages, tools, maxTokens = 700, temperature = 0.3 }, options = {}) {
  const body = {
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(tools?.length ? { tools } : {}),
  };
  const response = await postChat(env, body, options);
  const data = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (!message) throw new AIEndpointError(502, 'empty_answer', 'The assistant did not return an answer. Please try again.');
  return {
    text: typeof message.content === 'string' ? message.content.trim() : '',
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    finishReason: choice.finish_reason || null,
    usage: data.usage || null,
  };
}

/**
 * Parses one line of an SSE stream from Praxiom. Returns { text, usage, done } for the caller to act on.
 * The last chunk before [DONE] carries usage and an empty choices list.
 */
export function parseStreamLine(line) {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (payload === '[DONE]') return { done: true, text: '', usage: null };
  let chunk;
  try {
    chunk = JSON.parse(payload);
  } catch {
    return null;
  }
  const text = chunk?.choices?.[0]?.delta?.content;
  return { done: false, text: typeof text === 'string' ? text : '', usage: chunk?.usage || null };
}
