import React, { useEffect, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { VideoPlayer } from '../components/VideoPlayer';
import { DownloadButton } from '../components/DownloadButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorState } from '../components/ErrorState';
import { useDownloads } from '../context/DownloadsContext';
import { colors } from '../theme';
import type { LoveworldSingersVideo } from '../types';
import { formatDate, formatDuration } from '../utils/format';

interface Props {
  id: string;
  onBack: () => void;
}

/**
 * Playback of one LoveWorld Singers video. A saved copy plays offline; "Back to library" returns
 * to the list the viewer came from.
 */
export function LoveworldSingerVideoPage({ id, onBack }: Props) {
  const dl = useDownloads();
  const saved = dl.get(id);
  const [item, setItem] = useState<LoveworldSingersVideo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getLoveworldSingersVideo(id)
      .then((v) => {
        if (cancelled) return;
        if (!v) setNotFound(true); // unpublished or removed in the Admin Portal
        else setItem(v);
      })
      .catch(() => {
        if (!cancelled && saved?.status !== 'done') setError('Unable to load this video. Please check your internet connection.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const localUrl = dl.getLocalVideoUrl(id);
  const data = item ?? (saved?.status === 'done' ? saved.data : null);
  const videoUri = localUrl ?? item?.videoUrl;

  const share = async () => {
    if (!item) return;
    const url = item.videoUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      window.alert('This video doesn’t have a shareable link yet. Please try again later.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: `Watch "${item.title}" on Testimonies of Praise`, url });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="LoveWorld Singers" onBack={onBack} />
      {notFound && !data ? (
        <ErrorState message="This video is no longer available." onRetry={onBack} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !data ? (
        <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {videoUri ? (
            <VideoPlayer uri={videoUri} contentId={id} label={data.title} autoPlay />
          ) : (
            <div style={{ padding: '24px', background: colors.card, textAlign: 'center', color: colors.textMuted }}>Video is not available.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>{data.title}</h1>
            {item && (
              <span style={{ fontSize: '13px', color: colors.textMuted }}>
                {[formatDate(item.publishedAt), formatDuration(item.duration)].filter(Boolean).join('  •  ')}
              </span>
            )}
          </div>
          {data.description && <p style={{ margin: 0, fontSize: '15px', color: colors.text, lineHeight: 1.5 }}>{data.description}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {item && <DownloadButton data={item} kind="singers" />}
            {item && (
              <PrimaryButton title={copied ? 'LINK COPIED!' : 'SHARE'} variant="outline" icon={<Share2 size={18} />} onClick={() => void share()} />
            )}
            <PrimaryButton title="Back to library" variant="outline" icon={<ArrowLeft size={18} />} onClick={onBack} />
          </div>
        </div>
      )}
    </div>
  );
}
