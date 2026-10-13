import { auth } from './firebase';
import { repo } from './repository';

export function track(event: string, params: Record<string, any> = {}): void {
  repo.recordEvent(event, params, auth.currentUser?.uid).catch(() => {});
}
