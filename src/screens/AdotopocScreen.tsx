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
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import type { AdotopocConfig } from '@/types';

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

  const [isMuted, setIsMuted] = useState(true);
  const [showResourceCenter, setShowResourceCenter] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    repo.getAdotopocConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  const videoUri = config.introVideoUrl || DEFAULT_VIDEO_URL;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const toggleMute = () => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {!showResourceCenter ? (
        <View style={styles.landingContainer}>
          {/* Background Video */}
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />

          {/* Top Bar Controls */}
          <View style={styles.topBar}>
            {/* Sound Toggle Button */}
            <Pressable
              onPress={toggleMute}
              style={styles.soundBtn}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={20}
                color="#FFFFFF"
              />
            </Pressable>

            {/* Close Button with Logo Badge */}
            <Pressable
              onPress={() => nav.goBack()}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Image
                source={require('../../assets/LOG_xcvt3v.png')}
                style={styles.closeLogo}
                contentFit="contain"
              />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          {/* Bottom Gradient & Call To Action */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.65)', 'rgba(0, 0, 0, 0.96)']}
            style={styles.bottomGradient}
          >
            <View style={styles.ctaContent}>
              <Text style={styles.ctaPrompt}>
                Want to host A Day of Testimonies of Praise Outreaches and Crusade ?
              </Text>
              <Text style={styles.ctaSubText}>
                Click below to go to our resource center.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.resourceButton,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => setShowResourceCenter(true)}
                accessibilityRole="button"
                accessibilityLabel="Go to Our Resource Center"
              >
                <Text style={styles.buttonText}>Go to Our Resource Center</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      ) : (
        /* Resource Center WebView */
        <View style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Pressable
              onPress={() => setShowResourceCenter(false)}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.backBtnText}>Back to Home</Text>
            </Pressable>
          </View>

          {webviewLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#DDA853" />
              <Text style={styles.loadingText}>Loading Resources...</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  landingContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  soundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  closeLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
    zIndex: 20,
  },
  ctaContent: {
    gap: 12,
  },
  ctaPrompt: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ctaSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  resourceButton: {
    backgroundColor: '#DDA853',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: '#1A1001',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonArrow: {
    color: '#1A1001',
    fontSize: 18,
    fontWeight: '900',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  webviewHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
