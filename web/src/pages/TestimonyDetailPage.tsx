import React, { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { colors } from '../theme';
import { TopBar } from '../components/TopBar';
import { VideoPlayer } from '../components/VideoPlayer';
import { DownloadButton } from '../components/DownloadButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorState } from '../components/ErrorState';
import { repo } from '../api/repository';
import { useDownloads } from '../context/DownloadsContext';
import type { Testimony } from '../types';

interface Props {
  id: string;
  onBack: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function TestimonyDetailPage({ id, onBack }: Props) {
  const dl = useDownloads();
  const saved = dl.get(id);
  const [item, setItem] = useState<Testimony | null>(
    saved?.status === 'done' ? (saved.data as Testimony) : null
  );
  const [loading, setLoading] = useState(!item);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    repo
      .getTestimony(id)
      .then((t) => {
        if (cancelled) return;
        if (!t && !saved) {
          setError('This testimony is no longer available.');
        } else if (t) {
          setItem(t);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (!saved) {
          setError('Unable to load this testimony. Please check your internet connection.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, saved]);

  const handleShare = async () => {
    if (!item) return;
    const shareText = `Watch "${item.title}" on Testimonies of Praise!`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: shareText,
          url: shareUrl,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If downloaded offline, prefer offline Blob URL!
  const localBlobUrl = dl.getLocalVideoUrl(id);
  const videoUri = localBlobUrl ?? item?.videoUrl;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        backgroundColor: colors.bg,
        paddingBottom: 'calc(var(--sab, 0px) + 32px)',
        boxSizing: 'border-box',
      }}
    >
      <TopBar title="Testimony" onBack={onBack} />

      {error && !item ? (
        <ErrorState message={error} onRetry={onBack} />
      ) : loading && !item ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
          Loading praise…
        </div>
      ) : item ? (
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {videoUri ? (
            <VideoPlayer
              uri={videoUri}
              contentId={item.id}
              label={item.title}
              autoPlay
            />
          ) : (
            <div style={{ padding: '24px', backgroundColor: colors.card, textAlign: 'center', color: colors.textMuted }}>
              Video is not available.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {item.category && (
              <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: colors.accent, textTransform: 'uppercase' }}>
                {item.category}
              </span>
            )}
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: colors.text, margin: 0, lineHeight: '1.3' }}>
              {item.title}
            </h1>
            <span style={{ fontSize: '13px', color: colors.textMuted }}>
              {[item.authorName, formatDate(item.publishedAt ?? item.createdAt), formatDuration(item.duration)]
                .filter(Boolean)
                .join('  •  ')}
            </span>
          </div>

          {item.description && (
            <p style={{ fontSize: '15px', color: colors.text, lineHeight: '1.5', margin: 0 }}>
              {item.description}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            <DownloadButton data={item} />
            <PrimaryButton
              title={copied ? 'LINK COPIED!' : 'SHARE'}
              variant="outline"
              icon={<Share2 size={18} />}
              onClick={handleShare}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
