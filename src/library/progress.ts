/**
 * Keeps the listening position in step with the player. Writes are throttled (see shouldWriteProgress), and a
 * pause or the end of an item always writes, so another device never resumes from a stale position.
 */
import { recordProgress, type SaveInput } from './service';
import { LIBRARY_LIMITS, shouldWriteProgress } from './rules';

export class ProgressRecorder {
  private last: { ms: number; pos: number } | null = null;

  constructor(
    private readonly uid: string,
    private readonly input: SaveInput,
  ) {}

  update(positionSec: number, durationSec: number, force: boolean): void {
    if (!Number.isFinite(positionSec) || positionSec < LIBRARY_LIMITS.resumeStartSec) return;
    const now = Date.now();
    const due = shouldWriteProgress({ lastWrittenMs: this.last?.ms ?? null, nowMs: now, lastPositionSec: this.last?.pos ?? null, positionSec, force });
    if (!due) return;
    this.last = { ms: now, pos: positionSec };
    void recordProgress(this.uid, this.input, positionSec, Number.isFinite(durationSec) ? durationSec : 0).catch(() => undefined);
  }
}
