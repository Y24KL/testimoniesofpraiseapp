import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import type { AdotopocConfig } from '@/types';

// Scoped ADOTOPOC Palette (derived strictly from the ADOTOPOC logo)
const ADOTOPOC_COLORS = {
  bg: '#11070B',
  surface: '#220912',
  surfaceLight: '#330E1B',
  border: '#3D1020',
  crimson: '#7F0404',
  crimsonLight: '#A80505',
  cream: '#FBFAF5',
  creamMuted: 'rgba(251, 250, 245, 0.7)',
  creamSubtle: 'rgba(251, 250, 245, 0.4)',
};

const LOGO_URL = 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png';
const DEFAULT_VIDEO_URL =
  'https://res.cloudinary.com/duw6xrnpn/video/upload/v1792135475/ADOTOP_LOGO_OUTRO_m1awjk.mp4';
const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';

export function AdotopocScreen() {
  const nav = useNavigation();
  const [config, setConfig] = useState<AdotopocConfig>({
    resourcePageUrl: DEFAULT_PAGE_URL,
    introVideoUrl: DEFAULT_VIDEO_URL,
    introEnabled: true,
  });
  const [showVideo, setShowVideo] = useState(true);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    repo.getAdotopocConfig().then((cfg) => {
      setConfig(cfg);
      if (!cfg.introEnabled) {
        setShowVideo(false);
      }
    });
  }, []);

  const videoUri = config.introVideoUrl || DEFAULT_VIDEO_URL;
  const player = useVideoPlayer({ uri: videoUri }, (p) => {
    p.loop = false;
    p.play();
  });

  // When intro video finishes playing, automatically transition to embedded resources
  useEventListener(player, 'playToEnd', () => {
    setShowVideo(false);
  });

  const handleSkip = () => {
    player.pause();
    setShowVideo(false);
  };

  const handleReplayIntro = () => {
    setShowVideo(true);
    player.currentTime = 0;
    player.play();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={ADOTOPOC_COLORS.bg} />

      {/* ADOTOPOC Dedicated Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => nav.goBack()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to main app"
        >
          <Ionicons name="arrow-back" size={24} color={ADOTOPOC_COLORS.cream} />
        </Pressable>

        <View style={styles.branding}>
          <Image source={LOGO_URL} style={styles.logo} contentFit="contain" />
          <View>
            <Text style={styles.headerTitle}>ADOTOPOC</Text>
            <Text style={styles.headerSubtitle}>Resource Center</Text>
          </View>
        </View>

        {!showVideo ? (
          <Pressable
            onPress={handleReplayIntro}
            style={styles.replayBtn}
            accessibilityRole="button"
            accessibilityLabel="Replay intro video"
          >
            <Ionicons name="film-outline" size={16} color={ADOTOPOC_COLORS.cream} />
            <Text style={styles.replayText}>Intro</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {showVideo ? (
          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.videoPlayer}
              allowsFullscreen
              allowsPictureInPicture={false}
              nativeControls={false}
            />

            {/* Skip Button Overlay */}
            <Pressable
              onPress={handleSkip}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip intro video"
            >
              <Text style={styles.skipText}>Skip Intro</Text>
              <Ionicons name="play-skip-forward" size={14} color={ADOTOPOC_COLORS.cream} />
            </Pressable>

            <View style={styles.introCaption}>
              <Text style={styles.introTitle}>Welcome to ADOTOPOC</Text>
              <Text style={styles.introSub}>
                Apostolic Deliverance Outreach & Testimonies of Praise Online Community
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.webviewContainer}>
            {webviewLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={ADOTOPOC_COLORS.crimsonLight} />
                <Text style={styles.loadingText}>Loading ADOTOPOC Resources...</Text>
              </View>
            )}
            <WebView
              ref={webViewRef}
              source={{ uri: config.resourcePageUrl || DEFAULT_PAGE_URL }}
              style={styles.webview}
              onLoadStart={() => setWebviewLoading(true)}
              onLoadEnd={() => setWebviewLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              bounces={false}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ADOTOPOC_COLORS.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADOTOPOC_COLORS.border,
    backgroundColor: ADOTOPOC_COLORS.bg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ADOTOPOC_COLORS.cream,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: ADOTOPOC_COLORS.creamMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: ADOTOPOC_COLORS.crimson,
    borderWidth: 1,
    borderColor: ADOTOPOC_COLORS.crimsonLight,
  },
  replayText: {
    fontSize: 11,
    fontWeight: '700',
    color: ADOTOPOC_COLORS.cream,
  },
  content: {
    flex: 1,
    backgroundColor: ADOTOPOC_COLORS.bg,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 7, 11, 0.85)',
    borderWidth: 1,
    borderColor: ADOTOPOC_COLORS.crimsonLight,
    zIndex: 10,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
    color: ADOTOPOC_COLORS.cream,
  },
  introCaption: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 7, 11, 0.9)',
    borderWidth: 1,
    borderColor: ADOTOPOC_COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ADOTOPOC_COLORS.cream,
  },
  introSub: {
    fontSize: 12,
    color: ADOTOPOC_COLORS.creamMuted,
    textAlign: 'center',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: ADOTOPOC_COLORS.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: ADOTOPOC_COLORS.bg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ADOTOPOC_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    fontSize: 14,
    color: ADOTOPOC_COLORS.creamMuted,
    fontWeight: '600',
  },
});
