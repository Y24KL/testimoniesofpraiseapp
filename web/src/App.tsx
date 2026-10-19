import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DownloadsProvider } from './context/DownloadsContext';
import { BottomNavigation, type TabName } from './components/BottomNavigation';
import { OfflineBanner } from './components/OfflineBanner';
import { AddToHomeScreenModal } from './components/AddToHomeScreenModal';
import { AppDrawer } from './components/AppDrawer';
import { Logo } from './components/Logo';
import { colors, gradients } from './theme';

// Pages
import { WelcomePage } from './pages/WelcomePage';
import { EmailAuthPage } from './pages/EmailAuthPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { FirstTimeWelcomePage } from './pages/FirstTimeWelcomePage';
import { NotificationPrimerPage } from './pages/NotificationPrimerPage';
import { HomePage } from './pages/HomePage';
import { TestimoniesPage } from './pages/TestimoniesPage';
import { TestimonyDetailPage } from './pages/TestimonyDetailPage';
import { LivePage } from './pages/LivePage';
import { DownloadsPage } from './pages/DownloadsPage';
import { ShareTestimonyPage } from './pages/ShareTestimonyPage';
import { SponsorPage } from './pages/SponsorPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { RadioPage } from './pages/RadioPage';
import { AdotopocPage } from './pages/AdotopocPage';


type ViewState =
  | { type: 'tabs' }
  | { type: 'testimonyDetail'; id: string }
  | { type: 'shareTestimony' }
  | { type: 'sponsor' }
  | { type: 'notifications' }
  | { type: 'notificationSettings' }
  | { type: 'profile' }
  | { type: 'search' }
  | { type: 'promotions' }
  | { type: 'articles' }
  | { type: 'articleDetail'; id: string }
  | { type: 'radio' }
  | { type: 'adotopoc' };

type AuthScreen = 'welcome' | 'emailAuth' | 'forgotPassword';

function AppContent() {
  const { user, initializing, isNewAccount } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [primerSeen, setPrimerSeen] = useState<boolean>(() => {
    return localStorage.getItem('top:notification-primer-seen:v1') === 'true';
  });

  const [currentTab, setCurrentTab] = useState<TabName>('home');
  const [viewState, setViewState] = useState<ViewState>({ type: 'tabs' });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Handle URL deep links like #testimony/:id or #live
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#testimony/')) {
        const id = hash.replace('#testimony/', '');
        if (id) setViewState({ type: 'testimonyDetail', id });
      } else if (hash.startsWith('#article/')) {
        const id = hash.replace('#article/', '');
        if (id) setViewState({ type: 'articleDetail', id });
      } else if (hash === '#live') {
        setCurrentTab('live');
        setViewState({ type: 'tabs' });
      } else if (hash === '#radio') {
        setViewState({ type: 'radio' });
      } else if (hash === '#adotopoc') {
        setViewState({ type: 'adotopoc' });
      } else if (hash === '#articles') {
        setViewState({ type: 'articles' });
      } else if (hash === '#promotions') {
        setViewState({ type: 'promotions' });
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 1. Initializing / Session Restore
  if (initializing) {
    return (
      <div
        style={{
          width: '100%',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: gradients.hero,
          gap: '20px',
        }}
      >
        <Logo size={110} />
        <span
          style={{
            fontSize: '15px',
            fontWeight: '800',
            letterSpacing: '4px',
            color: colors.accent,
            textTransform: 'uppercase',
          }}
        >
          LOADING PRAISE
        </span>
        <div
          style={{
            width: '32px',
            height: '32px',
            border: `3px solid ${colors.border}`,
            borderTopColor: colors.accent,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  // 2. Unauthenticated flows
  if (!user) {
    if (authScreen === 'emailAuth') {
      return (
        <EmailAuthPage
          onBack={() => setAuthScreen('welcome')}
          onForgotPassword={() => setAuthScreen('forgotPassword')}
        />
      );
    }
    if (authScreen === 'forgotPassword') {
      return <ForgotPasswordPage onBack={() => setAuthScreen('emailAuth')} />;
    }
    return <WelcomePage onGoToEmail={() => setAuthScreen('emailAuth')} />;
  }

  // 3. First time new account welcome modal
  if (isNewAccount) {
    return <FirstTimeWelcomePage onDone={() => {}} />;
  }

  // 4. Notification primer (shown once after registration)
  if (!primerSeen) {
    return <NotificationPrimerPage onDone={() => setPrimerSeen(true)} />;
  }

  // 5. Modals / Stack Views
  if (viewState.type === 'testimonyDetail') {
    return (
      <TestimonyDetailPage
        id={viewState.id}
        onBack={() => setViewState({ type: 'tabs' })}
      />
    );
  }

  if (viewState.type === 'shareTestimony') {
    return <ShareTestimonyPage onBack={() => setViewState({ type: 'tabs' })} />;
  }

  if (viewState.type === 'sponsor') {
    return <SponsorPage onBack={() => setViewState({ type: 'tabs' })} />;
  }

  if (viewState.type === 'notifications') {
    return (
      <NotificationsPage
        onBack={() => setViewState({ type: 'tabs' })}
        onSelectTestimony={(id) => setViewState({ type: 'testimonyDetail', id })}
        onGoToLive={() => {
          setCurrentTab('live');
          setViewState({ type: 'tabs' });
        }}
      />
    );
  }

  if (viewState.type === 'notificationSettings') {
    return <NotificationSettingsPage onBack={() => setViewState({ type: 'profile' })} />;
  }

  if (viewState.type === 'profile') {
    return (
      <ProfilePage
        onBack={() => setViewState({ type: 'tabs' })}
        onGoToNotifications={() => setViewState({ type: 'notificationSettings' })}
        onGoToDownloads={() => {
          setCurrentTab('downloads');
          setViewState({ type: 'tabs' });
        }}
        onGoToShare={() => setViewState({ type: 'shareTestimony' })}
        onGoToSponsor={() => setViewState({ type: 'sponsor' })}
      />
    );
  }

  if (viewState.type === 'search') {
    return (
      <SearchPage
        onBack={() => setViewState({ type: 'tabs' })}
        onSelectTestimony={(id) => setViewState({ type: 'testimonyDetail', id })}
      />
    );
  }

  if (viewState.type === 'promotions') {
    return (
      <PromotionsPage
        onBack={() => setViewState({ type: 'tabs' })}
        onNavigateInternal={(route) => {
          if (route === 'Radio') setViewState({ type: 'radio' });
          else if (route === 'Adotopoc') setViewState({ type: 'adotopoc' });
          else if (route === 'Articles') setViewState({ type: 'articles' });
          else if (route.startsWith('ArticleDetails:')) {
            const id = route.split(':')[1];
            setViewState({ type: 'articleDetail', id });
          }
        }}
      />
    );
  }

  if (viewState.type === 'articles') {
    return (
      <ArticlesPage
        onBack={() => setViewState({ type: 'tabs' })}
        onSelectArticle={(id) => setViewState({ type: 'articleDetail', id })}
      />
    );
  }

  if (viewState.type === 'articleDetail') {
    return (
      <ArticleDetailPage
        articleId={viewState.id}
        onBack={() => setViewState({ type: 'articles' })}
      />
    );
  }

  if (viewState.type === 'radio') {
    return <RadioPage onBack={() => setViewState({ type: 'tabs' })} />;
  }

  if (viewState.type === 'adotopoc') {
    return <AdotopocPage onBack={() => setViewState({ type: 'tabs' })} />;
  }

  // 6. Main Tab Navigation
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: colors.bg,
        position: 'relative',
      }}
    >
      <OfflineBanner />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'home' && (
          <HomePage
            onSearch={() => setViewState({ type: 'search' })}
            onNotifications={() => setViewState({ type: 'notifications' })}
            onProfile={() => setIsDrawerOpen(true)}
            onMenu={() => setIsDrawerOpen(true)}
            onSelectTestimony={(id) => setViewState({ type: 'testimonyDetail', id })}
            onGoToLive={() => setCurrentTab('live')}
            onGoToTestimonies={() => setCurrentTab('testimonies')}
            onShareTestimony={() => setViewState({ type: 'shareTestimony' })}
            onGoToRadio={() => setViewState({ type: 'radio' })}
            onGoToAdotopoc={() => setViewState({ type: 'adotopoc' })}
            onGoToArticles={() => setViewState({ type: 'articles' })}
            onGoToPromotions={() => setViewState({ type: 'promotions' })}
          />
        )}

        {currentTab === 'testimonies' && (
          <TestimoniesPage
            onSearch={() => setViewState({ type: 'search' })}
            onNotifications={() => setViewState({ type: 'notifications' })}
            onProfile={() => setIsDrawerOpen(true)}
            onSelectTestimony={(id) => setViewState({ type: 'testimonyDetail', id })}
          />
        )}

        {currentTab === 'live' && (
          <LivePage
            onNotifications={() => setViewState({ type: 'notifications' })}
            onProfile={() => setIsDrawerOpen(true)}
          />
        )}

        {currentTab === 'downloads' && (
          <DownloadsPage
            onNotifications={() => setViewState({ type: 'notifications' })}
            onProfile={() => setIsDrawerOpen(true)}
            onSelectTestimony={(id) => setViewState({ type: 'testimonyDetail', id })}
          />
        )}
      </main>

      <BottomNavigation
        currentTab={currentTab}
        onTabChange={(t) => setCurrentTab(t)}
      />

      <AddToHomeScreenModal />

      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onProfile={() => setViewState({ type: 'profile' })}
        onGoToRadio={() => setViewState({ type: 'radio' })}
        onGoToAdotopoc={() => setViewState({ type: 'adotopoc' })}
        onGoToArticles={() => setViewState({ type: 'articles' })}
        onGoToPromotions={() => setViewState({ type: 'promotions' })}
        onGoToLive={() => {
          setCurrentTab('live');
          setViewState({ type: 'tabs' });
        }}
        onGoToTestimonies={() => {
          setCurrentTab('testimonies');
          setViewState({ type: 'tabs' });
        }}
        onShareTestimony={() => setViewState({ type: 'shareTestimony' })}
        onSponsor={() => setViewState({ type: 'sponsor' })}
        onGoToDownloads={() => {
          setCurrentTab('downloads');
          setViewState({ type: 'tabs' });
        }}
        onNotifications={() => setViewState({ type: 'notifications' })}
        onNotificationSettings={() => setViewState({ type: 'notificationSettings' })}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DownloadsProvider>
        <AppContent />
      </DownloadsProvider>
    </AuthProvider>
  );
}
