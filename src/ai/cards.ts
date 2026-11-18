/**
 * Verified content cards from the assistant. The Worker builds them only from records it read with the person's
 * own token, so the app only checks their shape and routes them. A card that does not match is dropped.
 */
export const CARD_KINDS = ['testimony', 'clip', 'lyrical', 'article', 'live'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export interface AssistantCard {
  kind: CardKind;
  id: string;
  title: string;
  subtitle: string;
  deepLink: string;
  verified: true;
  startSec?: number;
}

export const MAX_CARDS = 8;
const DEEP_LINK = 'testimoniesofpraise://';

/** Keeps only well-formed, verified cards. Anything else is ignored, never shown. */
export function parseCards(value: unknown): AssistantCard[] {
  if (!Array.isArray(value)) return [];
  const out: AssistantCard[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    if (!(CARD_KINDS as readonly string[]).includes(c.kind as string)) continue;
    if (typeof c.id !== 'string' || c.id.length === 0 || c.id.length > 100) continue;
    if (typeof c.title !== 'string' || c.title.length === 0) continue;
    if (typeof c.deepLink !== 'string' || !c.deepLink.startsWith(DEEP_LINK)) continue;
    if (c.verified !== true) continue;
    const startSec = typeof c.startSec === 'number' && Number.isFinite(c.startSec) && c.startSec >= 0 ? c.startSec : undefined;
    out.push({
      kind: c.kind as CardKind,
      id: c.id,
      title: c.title.slice(0, 200),
      subtitle: typeof c.subtitle === 'string' ? c.subtitle.slice(0, 200) : '',
      deepLink: c.deepLink,
      verified: true,
      ...(startSec !== undefined ? { startSec } : {}),
    });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

export type CardTarget =
  | { screen: 'TestimonyDetails'; params: { id: string; startAt?: number } }
  | { screen: 'LyricalAnalysisVideo'; params: { id: string } }
  | { screen: 'ArticleDetails'; params: { id: string } }
  | { screen: 'Live' };

/** Where a card opens inside the app. Uses the card's kind and id, never the link text. */
export function cardTarget(card: AssistantCard): CardTarget {
  switch (card.kind) {
    case 'clip':
      return { screen: 'TestimonyDetails', params: { id: card.id, startAt: card.startSec } };
    case 'testimony':
      return { screen: 'TestimonyDetails', params: { id: card.id } };
    case 'lyrical':
      return { screen: 'LyricalAnalysisVideo', params: { id: card.id } };
    case 'article':
      return { screen: 'ArticleDetails', params: { id: card.id } };
    case 'live':
      return { screen: 'Live' };
  }
}
