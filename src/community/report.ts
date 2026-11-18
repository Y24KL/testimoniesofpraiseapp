/** Files a report on community content. One report per person per item: a second attempt is refused. */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { cleanNote, reportKey, type ReportContentType, type ReportReason } from './rules';

export type ReportOutcome = 'sent' | 'already_reported';

export async function submitReport(uid: string, contentType: ReportContentType, contentId: string, reason: ReportReason, note?: string): Promise<ReportOutcome> {
  const key = reportKey(uid, contentType, contentId);
  if (!key) throw new Error('This item cannot be reported.');
  const ref = doc(db, 'contentReports', key);
  if ((await getDoc(ref)).exists()) return 'already_reported';
  const cleaned = cleanNote(note);
  await setDoc(ref, {
    reporterUid: uid,
    contentType,
    contentId,
    reason,
    ...(cleaned ? { note: cleaned } : {}),
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return 'sent';
}
