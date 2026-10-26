import React, { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { CommentsSection } from '../components/CommentsSection';
import { TestifierAvatar } from './WrittenTestimoniesPage';
import type { WrittenTestimony } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  id: string;
  onBack: () => void;
}

/** Reading page laid out like the Testimonies of Praise quote cards, then sharing and comments. */
export function WrittenTestimonyPage({ id, onBack }: Props) {
  const [item, setItem] = useState<WrittenTestimony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    repo
      .getWrittenTestimony(id)
      .then((w) => {
        if (cancelled) return;
        if (w) setItem(w);
        else setError('This testimony is no longer available.');
      })
      .catch(() => !cancelled && setError('Unable to load this testimony. Please check your internet connection.'));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const share = async () => {
    if (!item) return;
    const url = window.location.href;
    const by = item.authorName ? ` — ${item.authorName}` : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: `${item.title}${by}`, url });
        return;
      } catch {
        /* cancelled or blocked: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(`${item.title}${by}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const paragraphs = item ? item.body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean) : [];

  return (
    <div data-page style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 24px)' }}>
      <TopBar title="Written testimony" onBack={onBack} />
      {error && !item ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !item ? (
        <div className="skeleton" style={{ height: 360, margin: 16 }} aria-hidden="true" />
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <article style={{ borderRadius: 28, padding: '0 14px 14px', background: 'linear-gradient(135deg, #7A1FA2, #4B006E)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ marginRight: 8, padding: '8px 18px', borderRadius: '0 0 16px 16px', background: 'linear-gradient(90deg, #FFE08A, #F5C542, #D99A1E)', color: '#fff', fontWeight: 900, letterSpacing: 2, fontSize: 13 }}>
                TESTIMONIES OF PRAISE
              </span>
            </div>
            <div style={{ marginTop: 12, background: '#fff', borderRadius: 20, padding: '20px clamp(16px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <TestifierAvatar name={item.authorName} photoUrl={item.authorPhotoUrl} size={72} />
                <div style={{ flex: 1 }}>
                  {item.authorName ? <div style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 900, color: '#4B006E' }}>{item.authorName}</div> : null}
                  {item.churchZone ? <div style={{ fontWeight: 700, color: '#2B1B9A', fontSize: 14 }}>{item.churchZone}</div> : null}
                </div>
                <span aria-hidden="true" style={{ fontSize: 64, lineHeight: '60px', fontWeight: 900, color: '#7A1FA2', alignSelf: 'flex-start' }}>”</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(20px, 3vw, 26px)', color: '#4B006E', lineHeight: 1.25 }}>{item.title}</h1>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.6, fontWeight: 600, color: '#14063A' }}>
                  {p}
                </p>
              ))}
              <span style={{ fontSize: 12, color: '#6B5A86' }}>{[item.category, formatDate(item.publishedAt ?? item.createdAt)].filter(Boolean).join('  ·  ')}</span>
            </div>
          </article>
          <PrimaryButton title={copied ? 'LINK COPIED!' : 'SHARE THIS TESTIMONY'} variant="outline" icon={<Share2 size={18} />} onClick={share} />
          <CommentsSection type="written" mediaId={item.id} mediaTitle={item.title} />
        </div>
      )}
    </div>
  );
}
