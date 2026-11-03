import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { VideoPlayer } from '../components/VideoPlayer';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorState } from '../components/ErrorState';
import { colors } from '../theme';
import type { LyricalAnalysis } from '../types';
import { formatDate, formatDuration } from '../utils/format';

interface Props {
  id: string;
  onBack: () => void;
}

/** One lyrical analysis: the shared player with fullscreen, retry and buffering, plus its details. */
export function LyricalAnalysisVideoPage({ id, onBack }: Props) {
  const [item, setItem] = useState<LyricalAnalysis | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setNotFound(false);
    repo
      .getLyricalAnalysis(id)
      .then((v) => {
        if (cancelled) return;
        if (!v) setNotFound(true); // draft, unpublished or removed
        else setItem(v);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const meta = item ? [item.artistName, formatDate(item.publicationDate), formatDuration(item.duration)].filter(Boolean).join('  •  ') : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="Lyrical Analysis" onBack={onBack} />
      {notFound && !item ? (
        <ErrorState message="This analysis is no longer available." onRetry={onBack} />
      ) : error && !item ? (
        <ErrorState message="Unable to load this analysis. Please check your internet connection." onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {item.videoUrl ? (
            <VideoPlayer uri={item.videoUrl} contentId={item.id} label={item.title} autoPlay />
          ) : (
            <div style={{ padding: '24px', background: colors.card, textAlign: 'center', color: colors.textMuted }}>Video is not available.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>Lyrical Analysis</span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: colors.text, lineHeight: 1.25 }}>{item.title}</h1>
            {item.songTitle && <span style={{ fontSize: '15px', fontWeight: 700, color: colors.text }}>{`Song: ${item.songTitle}`}</span>}
            {meta && <span style={{ fontSize: '13px', color: colors.textMuted }}>{meta}</span>}
          </div>
          {item.description && <p style={{ margin: 0, fontSize: '15px', color: colors.text, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{item.description}</p>}
          <PrimaryButton title="Back to Lyrical Analysis" variant="outline" icon={<ArrowLeft size={18} />} onClick={onBack} />
        </div>
      )}
    </div>
  );
}
