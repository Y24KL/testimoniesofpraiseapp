import React, { useEffect, useState } from 'react';
import { Share2, User, Calendar } from 'lucide-react';
import { repo } from '../api/repository';
import { TopBar } from '../components/TopBar';
import { ErrorState } from '../components/ErrorState';
import { colors, radius } from '../theme';
import type { Article } from '../types';

interface Props {
  articleId: string;
  onBack: () => void;
}

const ARTICLES_READ_KEY = 'top:articles:read:v1';

function markAsRead(id: string) {
  try {
    const stored = localStorage.getItem(ARTICLES_READ_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(ARTICLES_READ_KEY, JSON.stringify(ids));
    }
  } catch { /* best effort */ }
}

function FormattedBody({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('### '))
          return <h3 key={idx} style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: colors.text }}>{trimmed.replace(/^###\s+/, '')}</h3>;
        if (trimmed.startsWith('## '))
          return <h2 key={idx} style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: colors.accent }}>{trimmed.replace(/^##\s+/, '')}</h2>;
        if (trimmed.startsWith('# '))
          return <h1 key={idx} style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: colors.text }}>{trimmed.replace(/^#\s+/, '')}</h1>;
        if (trimmed.startsWith('> '))
          return (
            <div key={idx} style={{
              borderLeft: `3px solid ${colors.accent}`,
              paddingLeft: '14px',
              paddingTop: '8px',
              paddingBottom: '8px',
              backgroundColor: 'rgba(245,197,66,0.05)',
              borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
            }}>
              <p style={{ margin: 0, fontStyle: 'italic', color: colors.text, fontSize: '15px', lineHeight: '22px' }}>
                {trimmed.replace(/^>\s+/, '')}
              </p>
            </div>
          );
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const lines = trimmed.split('\n');
          return (
            <ul key={idx} style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lines.map((line, lIdx) => (
                <li key={lIdx} style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', lineHeight: '24px' }}>
                  {line.replace(/^[-*]\s+/, '')}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={idx} style={{ margin: 0, fontSize: '16px', lineHeight: '26px', color: 'rgba(255,255,255,0.9)' }}>{trimmed}</p>;
      })}
    </div>
  );
}

export function ArticleDetailPage({ articleId, onBack }: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const item = await repo.getArticle(articleId);
        if (!mounted) return;
        setArticle(item);
        if (item) markAsRead(item.id);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load article');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [articleId]);

  const handleShare = async () => {
    if (!article) return;
    const url = `${window.location.origin}/articles/${article.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* ignore */ }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      backgroundColor: colors.bg,
      paddingBottom: 'calc(var(--sab, 0px) + 84px)',
      boxSizing: 'border-box',
    }}>
      <TopBar
        title="Article"
        onBack={onBack}
        actions={article ? [{ icon: Share2, label: 'Share', onClick: handleShare }] : undefined}
      />

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: colors.textMuted }}>
          Loading article...
        </div>
      ) : error || !article ? (
        <ErrorState message={error ?? 'Article not found or no longer available.'} onRetry={() => {
          setError(null);
          setLoading(true);
          repo.getArticle(articleId).then(a => { setArticle(a); setLoading(false); });
        }} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {article.coverImageUrl && (
            <div style={{ width: '100%', height: '220px', backgroundColor: colors.surface, overflow: 'hidden' }}>
              <img src={article.coverImageUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '680px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {article.category && (
              <span style={{
                alignSelf: 'flex-start',
                padding: '3px 8px',
                borderRadius: radius.pill,
                backgroundColor: 'rgba(245,197,66,0.2)',
                border: '1px solid rgba(245,197,66,0.4)',
                color: colors.accent,
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
              }}>
                {article.category}
              </span>
            )}

            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, lineHeight: '34px', color: colors.text }}>
              {article.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {article.author && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.textMuted, fontSize: '13px' }}>
                  <User size={14} />
                  <span style={{ fontWeight: 600 }}>{article.author}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.textMuted, fontSize: '13px' }}>
                <Calendar size={14} />
                <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: colors.border }} />

            <FormattedBody body={article.body} />
          </div>
        </div>
      )}
    </div>
  );
}
