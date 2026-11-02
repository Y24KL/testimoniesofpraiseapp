import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Search, X } from 'lucide-react';
import { repo } from '../api/repository';
import { LOVEWORLD_EYEBROW, LOVEWORLD_HERO_VIDEO, LOVEWORLD_TITLE } from '../constants/loveworldSingers';
import { getLoveworldHeroVideo } from '../api/loveworldSingersConfig';
import { PrimaryButton } from '../components/PrimaryButton';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { useDownloads } from '../context/DownloadsContext';
import { colors, gradients, radius } from '../theme';
import type { LoveworldSingersVideo } from '../types';
import { formatDate, formatDuration } from '../utils/format';

interface Props {
  onBack: () => void;
  onSelect: (id: string) => void;
}

/** "Worship with your LoveWorld Singers": published videos only (the query enforces it). */
export function LoveworldSingersPage({ onBack, onSelect }: Props) {
  const dl = useDownloads();
  const [items, setItems] = useState<LoveworldSingersVideo[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [heroVideo, setHeroVideo] = useState(LOVEWORLD_HERO_VIDEO);
  const libraryRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    void getLoveworldHeroVideo().then(setHeroVideo);
  }, []);

  const load = () => {
    setError(false);
    repo
      .getLoveworldSingersVideos()
      .then(setItems)
      .catch(() => setError(true));
  };

  useEffect(load, []);

  const { featured, recent } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = (items ?? []).filter((v) => !q || [v.title, v.description].some((s) => s.toLowerCase().includes(q)));
    return {
      featured: shown.filter((v) => v.isFeatured),
      recent: shown.filter((v) => !v.isFeatured).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    };
  }, [items, search]);

  const meta = (v: LoveworldSingersVideo) => [formatDate(v.publishedAt), formatDuration(v.duration)].filter(Boolean).join('  •  ');

  const card = (v: LoveworldSingersVideo) => {
    const saved = dl.get(v.id)?.status === 'done';
    return (
      <button
        key={v.id}
        type="button"
        onClick={() => onSelect(v.id)}
        aria-label={`Play ${v.title}`}
        style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, color: colors.text, cursor: 'pointer' }}
      >
        <div style={{ width: '112px', height: '64px', flexShrink: 0, borderRadius: radius.sm, overflow: 'hidden', background: colors.card }}>
          {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>{v.title}</span>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>{meta(v)}</span>
          {saved && <span style={{ fontSize: '10px', fontWeight: 800, color: colors.success }}>✓ SAVED</span>}
        </span>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.bg }}>
      <TopBar title="LoveWorld Singers" onBack={onBack} />
      <div style={{ position: 'relative', width: '100%', height: 'min(70vh, 560px)', minHeight: 360, overflow: 'hidden', background: 'linear-gradient(180deg, #4B006E 0%, #2E0044 50%, #12001C 100%)' }}>
        {heroVideo ? (
          <video src={heroVideo} autoPlay loop muted playsInline aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,0,28,0.1) 0%, rgba(18,0,28,0.9) 75%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 24px 32px', maxWidth: 680, boxSizing: 'border-box' }}>
          <span style={{ display: 'block', color: '#F5C542', fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>{LOVEWORLD_EYEBROW}</span>
          <h1 style={{ margin: '12px 0 0', fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>{LOVEWORLD_TITLE}</h1>
          <div style={{ marginTop: 24 }}>
            <PrimaryButton title="BROWSE VIDEOS" icon={<Play size={18} />} onClick={() => libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>
        </div>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '900px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <label ref={libraryRef} style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '46px', padding: '0 14px', borderRadius: radius.pill, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <Search size={18} color={colors.textSubtle} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs"
            aria-label="Search LoveWorld Singers videos"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.text, fontSize: '15px' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={18} color={colors.textSubtle} />
            </button>
          )}
        </label>

        {error && !items ? (
          <ErrorState message="Unable to load videos. Please check your internet connection." onRetry={load} />
        ) : !items ? (
          <div style={{ color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading praise…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No videos yet" message="New videos from the LoveWorld Singers will appear here." />
        ) : featured.length === 0 && recent.length === 0 ? (
          <EmptyState title="No matches" message="Try another song or word." />
        ) : (
          <>
            {featured.length > 0 && (
              <section aria-labelledby="singers-featured" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h2 id="singers-featured" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.text }}>Featured</h2>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                  {featured.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelect(v.id)}
                      aria-label={`Play ${v.title}`}
                      style={{ width: '240px', flexShrink: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: colors.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div style={{ width: '100%', height: '135px', borderRadius: radius.sm, overflow: 'hidden', background: colors.card }}>
                        {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>{v.title}</span>
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>{meta(v)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {recent.length > 0 && (
              <section aria-labelledby="singers-recent" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h2 id="singers-recent" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.text }}>Recent</h2>
                {recent.map(card)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
