import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DownloadsProvider } from './context/DownloadsContext';
import { AudioPlayerProvider, useAudioPlayer } from './audio/AudioPlayerContext';
import { MiniPlayer } from './audio/MiniPlayer';
import { BottomNavigation } from './components/BottomNavigation';
import { SideNav } from './components/SideNav';
import { OfflineBanner } from './components/OfflineBanner';
import { AddToHomeScreenModal } from './components/AddToHomeScreenModal';
import { AppDrawer } from './components/AppDrawer';
import { Logo } from './components/Logo';
import { useLive } from './hooks/useContent';
import { TAB_ROUTES, goBack, navigate, parseHash, useRoute, type Route } from './router';
import type { Promotion } from './types';
import { colors, gradients } from './theme';

// Home and Welcome are the entry screens, so they ship in the main bundle; everything else is
// code-split and fetched on first visit.
import { HomePage } from './pages/HomePage';
import { WelcomePage } from './pages/WelcomePage';
import { ProfileCompletionPage } from './pages/ProfileCompletionPage';
import { VerifyCodePage } from './pages/VerifyCodePage';
import { TourOverlay, TourProvider, useTour } from './tour/tour';

const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));

const EmailAuthPage = named(() => import('./pages/EmailAuthPage'), 'EmailAuthPage');
const ForgotPasswordPage = named(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const FirstTimeWelcomePage = named(() => import('./pages/FirstTimeWelcomePage'), 'FirstTimeWelcomePage');
const NotificationPrimerPage = named(() => import('./pages/NotificationPrimerPage'), 'NotificationPrimerPage');
const TestimoniesPage = named(() => import('./pages/TestimoniesPage'), 'TestimoniesPage');
const TestimonyDetailPage = named(() => import('./pages/TestimonyDetailPage'), 'TestimonyDetailPage');
const LivePage = named(() => import('./pages/LivePage'), 'LivePage');
const ListenPage = named(() => import('./pages/ListenPage'), 'ListenPage');
const AudioTestimonyPage = named(() => import('./pages/AudioTestimonyPage'), 'AudioTestimonyPage');
const WrittenTestimoniesPage = named(() => import('./pages/WrittenTestimoniesPage'), 'WrittenTestimoniesPage');
const AssistantPage = named(() => import('./pages/AssistantPage'), 'AssistantPage');
const WrittenTestimonyPage = named(() => import('./pages/WrittenTestimonyPage'), 'WrittenTestimonyPage');
const DownloadsPage = named(() => import('./pages/DownloadsPage'), 'DownloadsPage');
const ShareTestimonyPage = named(() => import('./pages/ShareTestimonyPage'), 'ShareTestimonyPage');
const SponsorPage = named(() => import('./pages/SponsorPage'), 'SponsorPage');
const NotificationsPage = named(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const NotificationSettingsPage = named(() => import('./pages/NotificationSettingsPage'), 'NotificationSettingsPage');
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage');
const SearchPage = named(() => import('./pages/SearchPage'), 'SearchPage');
const PromotionsPage = named(() => import('./pages/PromotionsPage'), 'PromotionsPage');
const ArticlesPage = named(() => import('./pages/ArticlesPage'), 'ArticlesPage');
const ArticleDetailPage = named(() => import('./pages/ArticleDetailPage'), 'ArticleDetailPage');
const AdotopocPage = named(() => import('./pages/AdotopocPage'), 'AdotopocPage');

function Splash() {
  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: gradients.hero, gap: '22px' }}>
      <Logo size={96} />
      <div style={{ width: '30px', height: '30px', border: `3px solid ${colors.border}`, borderTopColor: colors.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} aria-label="Loading" />
    </div>
  );
}

function PageFallback() {
  return (
    <div style={{ minHeight: '60dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true" aria-label="Loading">
      <span className="spinner light" style={{ width: 28, height: 28 }} />
    </div>
  );
}

/** Internal promotion targets ("radio", "articles", "article:<id>", ...) map onto real routes. */
function routeForDestination(dest: string): Route | null {
  const d = dest.trim();
  const lower = d.toLowerCase();
  if (lower === 'radio' || lower === 'listen') return { name: 'listen' };
  if (lower === 'adotopoc') return { name: 'adotopoc' };
  if (lower === 'articles') return { name: 'articles' };
  if (lower === 'sponsor') return { name: 'sponsor' };
  if (lower === 'share') return { name: 'share' };
  if (lower === 'live') return { name: 'live' };
  const m = d.match(/^(?:articledetails|article)[:/](.+)$/i);
  if (m) return { name: 'article', id: m[1] };
  const t = d.match(/^testimony[:/](.+)$/i);
  if (t) return { name: 'testimony', id: t[1] };
  return null;
}

const AFTER_AUTH_KEY = 'top:after-auth-route';
const isAuthRoute = (r: Route) => r.name === 'signin' || r.name === 'signup' || r.name === 'forgot';

function SignedOut({ route }: { route: Route }) {
  // Remember a shared deep link (e.g. #/testimony/abc) so signing in returns the visitor there.
  useEffect(() => {
    if (!isAuthRoute(route) && route.name !== 'home') {
      try {
        sessionStorage.setItem(AFTER_AUTH_KEY, window.location.hash);
      } catch {
        /* storage unavailable */
      }
    }
  }, [route]);

  if (route.name === 'signin' || route.name === 'signup') {
    return (
      <EmailAuthPage
        mode={route.name}
        onModeChange={(m: 'signin' | 'signup') => navigate({ name: m }, { replace: true })}
        onBack={() => goBack({ name: 'home' })}
        onForgotPassword={() => navigate({ name: 'forgot' })}
      />
    );
  }
  if (route.name === 'forgot') return <ForgotPasswordPage onBack={() => goBack({ name: 'signin' })} />;
  // Any other URL (including a shared deep link) shows Welcome; the URL is kept, so after signing in
  // the visitor lands exactly where the link pointed.
  return <WelcomePage onGetStarted={() => navigate({ name: 'signup' })} onSignIn={() => navigate({ name: 'signin' })} />;
}

function Shell({ route }: { route: Route }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { live } = useLive();
  const audio = useAudioPlayer();
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const isTab = TAB_ROUTES.has(route.name);
  const back = () => goBack({ name: 'home' });
  const go = (r: Route) => () => navigate(r);

  const openPromotion = useCallback((p: Promotion) => {
    if (!p.destinationUrl) return;
    if (/^https?:\/\//i.test(p.destinationUrl)) {
      window.open(p.destinationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const r = routeForDestination(p.destinationUrl);
    if (r) navigate(r);
  }, []);

  let page: React.ReactNode;
  switch (route.name) {
    case 'testimonies':
      page = <TestimoniesPage onSearch={go({ name: 'search' })} onNotifications={go({ name: 'notifications' })} onProfile={openDrawer} onSelectTestimony={(id: string) => navigate({ name: 'testimony', id })} />;
      break;
    case 'live':
      page = <LivePage onNotifications={go({ name: 'notifications' })} onProfile={openDrawer} />;
      break;
    case 'listen':
      page = <ListenPage onMenu={openDrawer} />;
      break;
    case 'downloads':
      page = <DownloadsPage onNotifications={go({ name: 'notifications' })} onProfile={openDrawer} onSelectTestimony={(id: string) => navigate({ name: 'testimony', id })} />;
      break;
    case 'testimony':
      page = <TestimonyDetailPage key={`${route.id}:${route.startAt ?? ''}`} id={route.id} onBack={back} startAt={route.startAt} />;
      break;
    case 'audio':
      page = <AudioTestimonyPage key={route.id} id={route.id} onBack={() => goBack({ name: 'listen' })} />;
      break;
    case 'assistant':
      page = <AssistantPage onBack={back} />;
      break;
    case 'written':
      page = <WrittenTestimoniesPage onBack={back} onOpen={(id: string) => navigate({ name: 'writtenTestimony', id })} />;
      break;
    case 'writtenTestimony':
      page = <WrittenTestimonyPage key={route.id} id={route.id} onBack={() => goBack({ name: 'written' })} />;
      break;
    case 'share':
      page = <ShareTestimonyPage onBack={back} />;
      break;
    case 'sponsor':
      page = <SponsorPage onBack={back} />;
      break;
    case 'notifications':
      page = <NotificationsPage onBack={back} onSelectTestimony={(id: string) => navigate({ name: 'testimony', id })} onGoToLive={go({ name: 'live' })} />;
      break;
    case 'notificationSettings':
      page = <NotificationSettingsPage onBack={() => goBack({ name: 'profile' })} />;
      break;
    case 'profile':
      page = (
        <ProfilePage
          onBack={back}
          onGoToNotifications={go({ name: 'notificationSettings' })}
          onGoToDownloads={go({ name: 'downloads' })}
          onGoToShare={go({ name: 'share' })}
          onGoToSponsor={go({ name: 'sponsor' })}
        />
      );
      break;
    case 'search':
      page = <SearchPage onBack={back} onSelectTestimony={(id: string) => navigate({ name: 'testimony', id })} />;
      break;
    case 'promotions':
      page = (
        <PromotionsPage
          onBack={back}
          onNavigateInternal={(dest: string) => {
            const r = routeForDestination(dest);
            if (r) navigate(r);
          }}
        />
      );
      break;
    case 'articles':
      page = <ArticlesPage onBack={back} onSelectArticle={(id: string) => navigate({ name: 'article', id })} />;
      break;
    case 'article':
      page = <ArticleDetailPage key={route.id} articleId={route.id} onBack={() => goBack({ name: 'articles' })} />;
      break;
    case 'adotopoc':
      page = <AdotopocPage onBack={back} />;
      break;
    default:
      page = <HomePage onMenu={openDrawer} onOpenPromotion={openPromotion} />;
  }

  return (
    <div className="app-shell">
      <SideNav current={route.name} isLive={!!live?.isLive} />
      <main className="app-main" key={route.name === 'testimony' || route.name === 'audio' || route.name === 'article' || route.name === 'writtenTestimony' ? `${route.name}:${route.id}` : route.name}>
        <OfflineBanner />
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </main>

      {isTab ? <BottomNavigation current={route.name} /> : null}
      {audio.track ? <MiniPlayer withNav={isTab} onOpen={go({ name: 'listen' })} /> : null}
      <AddToHomeScreenModal />

      <AppDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onProfile={go({ name: 'profile' })}
        onGoToRadio={go({ name: 'listen' })}
        onGoToAdotopoc={go({ name: 'adotopoc' })}
        onGoToArticles={go({ name: 'articles' })}
        onGoToWritten={go({ name: 'written' })}
        onGoToAssistant={go({ name: 'assistant' })}
        onGoToPromotions={go({ name: 'promotions' })}
        onGoToLive={go({ name: 'live' })}
        onGoToTestimonies={go({ name: 'testimonies' })}
        onShareTestimony={go({ name: 'share' })}
        onSponsor={go({ name: 'sponsor' })}
        onGoToDownloads={go({ name: 'downloads' })}
        onNotifications={go({ name: 'notifications' })}
        onNotificationSettings={go({ name: 'notificationSettings' })}
      />
    </div>
  );
}

function AppContent() {
  const { user, initializing, isNewAccount, profileChecked, needsProfile, sessionVerified } = useAuth();
  const tour = useTour();
  const route = useRoute();
  const [primerSeen, setPrimerSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('top:notification-primer-seen:v1') === 'true';
    } catch {
      return true;
    }
  });

  // Auth-only URLs make no sense once signed in: continue to the remembered deep link, or Home.
  useEffect(() => {
    if (!user || !isAuthRoute(route)) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(AFTER_AUTH_KEY);
      sessionStorage.removeItem(AFTER_AUTH_KEY);
    } catch {
      /* storage unavailable */
    }
    const target = pending ? parseHash(pending) : null;
    navigate(target && !isAuthRoute(target) ? target : { name: 'home' }, { replace: true });
  }, [user, route]);

  // Wait for the signed-in user's profile status too, so the app never flashes before the form.
  if (initializing || !profileChecked) return <Splash />;

  let content: React.ReactNode;
  if (!user) content = <SignedOut route={route} />;
  else if (!sessionVerified) content = <VerifyCodePage />;
  else if (needsProfile) content = <ProfileCompletionPage />;
  else if (isNewAccount) content = <FirstTimeWelcomePage onDone={() => tour.start()} />;
  else if (!primerSeen) content = <NotificationPrimerPage onDone={() => setPrimerSeen(true)} />;
  else content = <Shell route={route} />;

  return (
    <>
      <Suspense fallback={<Splash />}>{content}</Suspense>
      <TourOverlay />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DownloadsProvider>
        <AudioPlayerProvider>
          <TourProvider>
            <AppContent />
          </TourProvider>
        </AudioPlayerProvider>
      </DownloadsProvider>
    </AuthProvider>
  );
}
