import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronRight,
  CloudDownload,
  Globe,
  Headphones,
  Heart,
  Megaphone,
  Menu,
  Pause,
  Play,
  PlayCircle,
  Search,
  Sparkles,
  Star,
  Video,
} from 'lucide-react';
import { repo } from '../api/repository';
import { useAudioPlayer } from '../audio/AudioPlayerContext';
import { audioTrack, radioTrack } from '../audio/tracks';
import { EmailVerifyBanner } from '../components/EmailVerifyBanner';
import { ErrorState } from '../components/ErrorState';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useDownloads } from '../context/DownloadsContext';
import { useLive, useTestimonies } from '../hooks/useContent';
import { navigate } from '../router';
import type { Article, AudioTestimony, Promotion, RadioConfig, Testimony } from '../types';
import { formatDate, formatDuration } from '../utils/format';

interface Props {
  onMenu: () => void;
  onOpenPromotion: (p: Promotion) => void;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function SectionHead({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {action ? (
        <button type="button" className="link-btn" onClick={onAction}>
          {action} <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function TestimonyTile({ item }: { item: Testimony }) {
  const dur = formatDuration(item.duration);
  return (
    <button type="button" className="media-card" onClick={() => navigate({ name: 'testimony', id: item.id })} aria-label={`${item.title}${item.authorName ? `, by ${item.authorName}` : ''}`}>
      <div className="media-thumb">
        {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" decoding="async" /> : <PlayCircle size={28} />}
        <span className="media-play">
          <Play size={13} fill="currentColor" style={{ marginLeft: 2 }} />
        </span>
        {dur ? <span className="media-dur">{dur}</span> : null}
      </div>
      {item.category ? <span className="media-cat">{item.category}</span> : null}
      <p className="media-title">{item.title}</p>
      <span className="media-meta">{[item.authorName, formatDate(item.publishedAt ?? item.createdAt)].filter(Boolean).join('  ·  ')}</span>
    </button>
  );
}

export function HomePage({ onMenu, onOpenPromotion }: Props) {
  const { user } = useAuth();
  const player = useAudioPlayer();
  const { items: downloads } = useDownloads();
  const feat = useTestimonies({ featuredOnly: true, limit: 1 });
  const latest = useTestimonies({ limit: 10 });
  const { live } = useLive();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [radio, setRadio] = useState<RadioConfig | null>(null);
  const [audio, setAudio] = useState<AudioTestimony[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const loadExtras = useCallback(() => {
    // Secondary sections are best-effort: a failure hides the section instead of blocking Home.
    repo.getPromotions().then(setPromotions).catch(() => undefined);
    repo.getAudioTestimonies(3).then(setAudio).catch(() => undefined);
    repo.getArticles(4).then(setArticles).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadExtras();
    return repo.subscribeRadio(setRadio, () => undefined);
  }, [loadExtras]);

  const hero = feat.items[0] ?? latest.items[0];
  const rest = useMemo(() => latest.items.filter((i) => i.id !== hero?.id), [latest.items, hero?.id]);
  const saved = downloads.filter((d) => d.status === 'done').length;
  const radioOn = Boolean(radio?.isLive && radio.streamUrl);
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  const tiles: [React.ComponentType<{ size?: number }>, string, () => void, number?][] = [
    [PlayCircle, 'Testimonies', () => navigate({ name: 'testimonies' })],
    [Headphones, 'Listen', () => navigate({ name: 'listen' })],
    [Video, 'Live', () => navigate({ name: 'live' })],
    [BookOpen, 'Articles', () => navigate({ name: 'articles' })],
    [Globe, 'ADOTOPOC', () => navigate({ name: 'adotopoc' })],
    [Megaphone, 'Events', () => navigate({ name: 'promotions' })],
    [Heart, 'Share', () => navigate({ name: 'share' })],
    [CloudDownload, 'Saved', () => navigate({ name: 'downloads' }), saved],
  ];

  return (
    <div className="home" data-page>
      <header className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="hide-desktop" style={{ display: 'inline-flex' }}>
            <Logo size={36} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="home-hello">
              {greeting()}
              {firstName ? ',' : ''}
            </div>
            <h1 className="home-name">{firstName ?? 'Welcome'}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="icon-btn" onClick={() => navigate({ name: 'search' })} aria-label="Search">
            <Search size={20} />
          </button>
          <button type="button" className="icon-btn" onClick={() => navigate({ name: 'notifications' })} aria-label="Notifications">
            <Bell size={20} />
          </button>
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="Open menu">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <EmailVerifyBanner />

      <div className="page-pad page-width">
        {live?.isLive ? (
          <button type="button" className="hero live" onClick={() => navigate({ name: 'live' })} aria-label={`Live now: ${live.title ?? 'Live broadcast'}. Watch live`}>
            {live.thumbnail ? <img src={live.thumbnail} alt="" decoding="async" /> : null}
            <div className="hero-body">
              <span className="badge-live">
                <i /> LIVE NOW
              </span>
              <h2 className="hero-title">{live.title ?? 'We’re live now'}</h2>
              {live.description ? <p className="hero-sub">{live.description}</p> : null}
              <span className="btn btn-gold btn-sm" style={{ marginTop: 6 }}>
                <Play size={16} fill="currentColor" /> Watch live
              </span>
            </div>
          </button>
        ) : hero ? (
          <button type="button" className="hero" onClick={() => navigate({ name: 'testimony', id: hero.id })} aria-label={`Featured testimony: ${hero.title}. Play`}>
            {hero.thumbnail ? <img src={hero.thumbnail} alt="" decoding="async" fetchPriority="high" /> : null}
            <div className="hero-body">
              <span className="badge-gold">
                <Star size={11} fill="currentColor" /> {hero.isFeatured ? 'FEATURED' : (hero.category ?? 'NEW').toUpperCase()}
              </span>
              <h2 className="hero-title">{hero.title}</h2>
              <p className="hero-sub">{[hero.authorName, formatDuration(hero.duration)].filter(Boolean).join('  ·  ')}</p>
              <span className="btn btn-gold btn-sm" style={{ marginTop: 6 }}>
                <Play size={16} fill="currentColor" /> Watch testimony
              </span>
            </div>
          </button>
        ) : latest.loading || feat.loading ? (
          <div className="skeleton" style={{ minHeight: 300, borderRadius: 28 }} aria-hidden="true" />
        ) : null}

        {/* Real broadcast state only. When the video broadcast is off, point to what IS available. */}
        {live && !live.isLive ? (
          <div className="status-row">
            <button type="button" className="status-main" onClick={() => navigate({ name: radioOn ? 'listen' : 'live' })}>
              <span className="status-dot" style={radioOn ? { background: 'var(--live)' } : undefined} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{radioOn ? 'TOP Radio is on air' : 'Live broadcast is offline'}</b>
                <small>{radioOn ? radio?.currentProgramme || 'Listen live while you browse' : 'We’ll let you know when we go live'}</small>
              </span>
              {radioOn ? null : <ChevronRight size={18} color="var(--text-subtle)" />}
            </button>
            {radioOn && radio ? (
              <button type="button" className="round-btn" style={{ width: 34, height: 34 }} aria-label="Play TOP Radio" onClick={() => player.play(radioTrack(radio))}>
                <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />
              </button>
            ) : null}
          </div>
        ) : null}

        <SectionHead title="Explore" />
        <nav className="explore" aria-label="Explore">
          {tiles.map(([Icon, label, onClick, badge]) => (
            <button key={label} type="button" className="tile" onClick={onClick} aria-label={badge ? `${label}, ${badge}` : label}>
              <span className="tile-icon">
                <Icon size={22} />
                {badge ? <span className="tile-badge">{badge > 99 ? '99+' : badge}</span> : null}
              </span>
              {label}
            </button>
          ))}
        </nav>

        {promotions.length > 0 ? (
          <>
            <SectionHead title="Highlights & events" action="See all" onAction={() => navigate({ name: 'promotions' })} />
            <div className="rail no-scrollbar">
              {promotions.slice(0, 8).map((p) => (
                <button key={p.id} type="button" className="media-card" onClick={() => onOpenPromotion(p)} aria-label={p.title}>
                  <div className="media-thumb">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" decoding="async" /> : <Megaphone size={26} />}</div>
                  {p.category ? <span className="media-cat">{p.category}</span> : null}
                  <p className="media-title">{p.title}</p>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <SectionHead title="Latest testimonies" sub="Stories of God’s faithfulness" action="See all" onAction={() => navigate({ name: 'testimonies' })} />
        {latest.loading && !latest.items.length ? (
          <div className="rail no-scrollbar" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: 220, aspectRatio: '16 / 9' }} />
            ))}
          </div>
        ) : latest.error && !latest.items.length ? (
          <ErrorState message="We couldn’t load testimonies. Check your connection." onRetry={latest.retry} />
        ) : rest.length ? (
          <div className="rail no-scrollbar">
            {rest.map((t) => (
              <TestimonyTile key={t.id} item={t} />
            ))}
          </div>
        ) : (
          <p className="media-meta">{hero ? 'More testimonies are on the way.' : 'New testimonies will appear here as soon as they’re published.'}</p>
        )}

        {audio.length > 0 ? (
          <>
            <SectionHead title="Listen now" sub="Audio testimonies" action="All audio" onAction={() => navigate({ name: 'listen' })} />
            {audio.map((a) => {
              const tr = audioTrack(a);
              const current = player.track?.id === tr.id;
              const playing = current && player.status === 'playing';
              return (
                <button key={a.id} type="button" className={`audio-row ${current ? 'active' : 'idle'}`} onClick={() => (playing ? player.pause() : player.play(tr))} aria-label={`${playing ? 'Pause' : 'Play'} ${a.title}`}>
                  <span className="round-btn">{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="media-title" style={{ fontSize: 14, WebkitLineClamp: 1 }}>
                      {a.title}
                    </span>
                    <span className="media-meta" style={{ display: 'block' }}>
                      {[a.speaker, formatDuration(a.duration)].filter(Boolean).join('  ·  ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        ) : null}

        {articles.length > 0 ? (
          <>
            <SectionHead title="Articles & insights" action="See all" onAction={() => navigate({ name: 'articles' })} />
            <div className="rail no-scrollbar">
              {articles.map((a) => (
                <button key={a.id} type="button" className="media-card" onClick={() => navigate({ name: 'article', id: a.id })} aria-label={`Article: ${a.title}`}>
                  <div className="media-thumb">{a.coverImageUrl ? <img src={a.coverImageUrl} alt="" loading="lazy" decoding="async" /> : <BookOpen size={26} />}</div>
                  {a.category ? <span className="media-cat">{a.category}</span> : null}
                  <p className="media-title">{a.title}</p>
                  <span className="media-meta">{[a.author, formatDate(a.publishedAt ?? a.createdAt)].filter(Boolean).join('  ·  ')}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {saved > 0 ? (
          <button type="button" className="saved-row" onClick={() => navigate({ name: 'downloads' })}>
            <CloudDownload size={20} color="var(--success)" />
            <span style={{ flex: 1 }}>
              {saved} {saved === 1 ? 'testimony' : 'testimonies'} saved for offline viewing
            </span>
            <ChevronRight size={18} color="var(--text-subtle)" />
          </button>
        ) : null}

        <section className="cta-card">
          <Sparkles size={22} color="var(--gold)" />
          <h3>What has God done for you?</h3>
          <p>Share your testimony. Someone needs to hear it today.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" className="btn btn-gold btn-sm" onClick={() => navigate({ name: 'share' })}>
              <Heart size={16} /> Share testimony
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate({ name: 'sponsor' })}>
              Sponsor
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
