import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, ChevronRight, Clock, EyeOff, FileText, Mic, Music, PlayCircle, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../router';
import { formatDuration } from '../utils/format';
import {
  INTEREST_LABELS,
  INTEREST_TAGS,
  cachedHome,
  clearHomeCache,
  fetchHome,
  getDiscoverySettings,
  markOpened,
  markShown,
  saveDiscoverySettings,
  type HomeItem,
  type HomeSections,
  type InterestTag,
} from '../api/personalHome';

const TYPE_LABEL: Record<HomeItem['type'], string> = { testimony: 'Testimony', written: 'Written', article: 'Article', lyrical: 'Lyrical Analysis', loveworld: 'LoveWorld Singers' };
const TYPE_ICON = { testimony: PlayCircle, written: FileText, article: BookOpen, lyrical: Music, loveworld: Mic } as const;

function Head({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
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

/**
 * Personal sections for signed-in visitors: Continue, For you, New in your interests, Featured and Your
 * interests. The cached copy shows at once; a stale one refreshes in the background. If the service is
 * unreachable the cached copy (or nothing) is shown, and the rest of the home page is unaffected.
 */
export function PersonalHome() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [sections, setSections] = useState<HomeSections | null>(null);
  const [editing, setEditing] = useState(false);
  const shownFor = useRef(0);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!uid) return;
      const cached = cachedHome(uid);
      if (cached) setSections(cached.sections);
      if (cached?.fresh && !refresh) return;
      try {
        setSections(await fetchHome(uid, refresh));
      } catch {
        /* keep the cached copy */
      }
    },
    [uid],
  );

  useEffect(() => {
    setSections(null);
    void load(false);
  }, [load]);

  useEffect(() => {
    if (uid && sections && sections.generatedAt !== shownFor.current) {
      shownFor.current = sections.generatedAt;
      markShown(uid, sections.forYou);
    }
  }, [uid, sections]);

  if (!uid || !sections) return null;

  const open = (item: HomeItem) => {
    markOpened(uid, item);
    if (item.type === 'testimony') navigate({ name: 'testimony', id: item.id, ...(item.positionSec ? { startAt: item.positionSec } : {}) });
    else if (item.type === 'written') navigate({ name: 'writtenTestimony', id: item.id });
    else if (item.type === 'article') navigate({ name: 'article', id: item.id });
    else if (item.type === 'lyrical') navigate({ name: 'lyricalVideo', id: item.id });
    else navigate({ name: 'singer', id: item.id });
  };

  const onSaved = () => {
    setEditing(false);
    clearHomeCache(uid);
    void load(true);
  };

  return (
    <>
      {sections.continue.length ? (
        <>
          <Head title="Continue where you left off" />
          <Rail items={sections.continue} onOpen={open} progress />
        </>
      ) : null}
      {sections.personalized && sections.forYou.length ? (
        <>
          <Head title="For you" sub="Picked from your interests and what you watch" />
          <Rail items={sections.forYou} onOpen={open} />
        </>
      ) : null}
      {sections.newInInterests.length ? (
        <>
          <Head title="New in your interests" />
          <Rail items={sections.newInInterests} onOpen={open} />
        </>
      ) : null}
      {sections.featured.length ? (
        <>
          <Head title="Featured you haven’t seen" />
          <Rail items={sections.featured} onOpen={open} />
        </>
      ) : null}

      <Head title="Your interests" action={sections.personalized ? 'Edit' : undefined} onAction={() => setEditing(true)} />
      {!sections.personalized ? (
        <Prompt icon={<EyeOff size={20} />} title="Personal recommendations are off" body="Your home page shows the same content for everyone." action="Turn on" onClick={() => setEditing(true)} />
      ) : sections.interests.length ? (
        <div className="ph-chips">
          {sections.interests.map((tag) => (
            <button key={tag} type="button" className="ph-chip" onClick={() => setEditing(true)} aria-label={`${INTEREST_LABELS[tag as InterestTag] ?? tag}. Edit interests`}>
              {INTEREST_LABELS[tag as InterestTag] ?? tag}
            </button>
          ))}
        </div>
      ) : (
        <Prompt icon={<Sparkles size={20} />} title="What inspires you?" body="Choose a few topics and we’ll recommend testimonies and worship you’ll love." action="Choose interests" onClick={() => setEditing(true)} />
      )}

      {editing ? <InterestsDialog uid={uid} onClose={() => setEditing(false)} onSaved={onSaved} /> : null}
    </>
  );
}

function Rail({ items, onOpen, progress }: { items: HomeItem[]; onOpen: (i: HomeItem) => void; progress?: boolean }) {
  return (
    <div className="rail no-scrollbar">
      {items.map((item) => {
        const Icon = TYPE_ICON[item.type];
        const pct = progress && item.durationSec ? Math.min(100, Math.round(((item.positionSec ?? 0) / item.durationSec) * 100)) : 0;
        return (
          <button key={`${item.type}:${item.id}`} type="button" className="media-card" onClick={() => onOpen(item)} aria-label={`${TYPE_LABEL[item.type]}: ${item.title}. ${item.reasonText}`}>
            <div className="media-thumb">
              <Icon size={26} />
              {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" decoding="async" onError={(e) => ((e.currentTarget.style.display = 'none'))} /> : null}
              {item.duration && !progress ? <span className="ph-duration">{formatDuration(item.duration)}</span> : null}
              {pct > 0 ? (
                <span className="ph-progress" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
              ) : null}
            </div>
            <span className="media-cat">{TYPE_LABEL[item.type]}</span>
            <p className="media-title">{item.title}</p>
            <span className="ph-reason">
              {item.reason === 'continue' ? <Clock size={12} /> : <Sparkles size={12} />}
              {item.reasonText}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Prompt({ icon, title, body, action, onClick }: { icon: ReactNode; title: string; body: string; action: string; onClick: () => void }) {
  return (
    <div className="ph-prompt">
      <span className="ph-prompt-icon">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="ph-prompt-title">{title}</p>
        <p className="ph-prompt-body">{body}</p>
      </div>
      <button type="button" className="btn btn-gold btn-sm" onClick={onClick}>{action}</button>
    </div>
  );
}

function InterestsDialog({ uid, onClose, onSaved }: { uid: string; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [personal, setPersonal] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    getDiscoverySettings(uid)
      .then((s) => {
        setInterests(s.interests);
        setPersonal(!s.optOut);
      })
      .catch(() => setError('Could not load your interests. You can still choose new ones.'))
      .finally(() => setReady(true));
  }, [uid]);

  const toggle = (tag: InterestTag) => setInterests((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveDiscoverySettings(uid, { interests, optOut: !personal });
      onSaved();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} className="ph-dialog" aria-labelledby="ph-dialog-title" onClose={onClose} onCancel={onClose}>
      <div className="ph-dialog-head">
        <h2 id="ph-dialog-title">Your interests</h2>
        <button type="button" className="round-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <p className="ph-dialog-body">Choose the topics you enjoy. We use them, and what you watch, to recommend content. Nothing is shared.</p>
      {!ready ? (
        <div className="skeleton" style={{ height: 120 }} aria-hidden="true" />
      ) : (
        <>
          <div className="ph-chips" style={{ padding: 0 }} role="group" aria-label="Interests">
            {INTEREST_TAGS.map((tag) => {
              const on = interests.includes(tag);
              return (
                <button key={tag} type="button" className={`ph-chip${on ? ' on' : ''}`} aria-pressed={on} disabled={!personal} onClick={() => toggle(tag)}>
                  {on ? <Check size={14} /> : null}
                  {INTEREST_LABELS[tag]}
                </button>
              );
            })}
          </div>
          <label className="ph-switch">
            <span>
              <b>Personal recommendations</b>
              <small>When off, we stop using your activity and show everyone the same home page.</small>
            </span>
            <input type="checkbox" role="switch" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
          </label>
          {error ? <p className="ph-error" role="alert">{error}</p> : null}
          <button type="button" className="btn btn-gold btn-block" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      )}
    </dialog>
  );
}
