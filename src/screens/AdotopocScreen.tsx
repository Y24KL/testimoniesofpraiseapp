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
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { repo } from '@/api';
import type { AdotopocConfig } from '@/types';

const DEFAULT_PAGE_URL = 'https://testimoniesofpraiseweb.onrender.com/adotopoc';

// New Color Palette matching the web landing page
const COLORS = {
  bg: '#0a0a0a',
  gold: '#D4AF37',
  goldButton: '#e2b763',
  blueContainer: 'rgba(10, 25, 50, 0.85)',
  blueBorder: '#1e40af',
  textLight: '#FFFFFF',
  textMuted: '#94a3b8',
};

export function AdotopocScreen() {
  const nav = useNavigation();
  const [config, setConfig] = useState<AdotopocConfig>({
    resourcePageUrl: DEFAULT_PAGE_URL,
    introVideoUrl: '',
    introEnabled: false,
  });
  
  // Replaces the video state: toggles between the Landing UI and the WebView
  const [showResourceCenter, setShowResourceCenter] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    repo.getAdotopocConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {!showResourceCenter ? (
        /* --- LANDING PAGE (Matches your web version screenshot) --- */
        <View style={styles.landingContainer}>
          
          {/* Top Nav: Close button matching the web layout */}
          <View style={styles.topNav}>
            <Pressable onPress={() => nav.goBack()} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={24} color="#555" />
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.contentWrapper}>
            {/* 1. LMM Ministry Logo */}
            <View style={styles.logoContainer}>
              {/* TODO: Update this URI to your actual LMM logo asset */}
              <Image 
                source={{ uri: 'https://res.cloudinary.com/duw6xrnpn/image/upload/v1789425387/LOG_xcvt3v.png' }} 
                style={styles.lmmLogo}
                contentFit="contain"
              />
            </View>

            {/* 2. Main Header Graphic / Title Lockup */}
            <View style={styles.heroSection}>
              {/* Optional: Add your flags image here if you have it exported */}
              {/* <Image source={require('../assets/flags.png')} style={{height: 50, width: '100%'}} /> */}
              
              <Text style={styles.subTitleTop}>A DAY OF</Text>
              <Text style={styles.mainTitlePrimary}>TESTIMONIES</Text>
              <Text style={styles.mainTitleMiddle}>OF</Text>
              <Text style={styles.mainTitlePrimary}>PRAISE</Text>
              <Text style={styles.subTitleBottom}>OUTREACHES & CRUSADES</Text>
            </View>

            {/* 3. Footer Call-to-Action Card */}
            <View style={styles.ctaCard}>
              <Text style={styles.ctaPrompt}>
                Want to host a day of Testimonies of Praise outreaches and crusade?
              </Text>
              <Text style={styles.ctaSubText}>
                Click below to go to our resource center.
              </Text>

              <Pressable 
                style={styles.resourceButton}
                onPress={() => setShowResourceCenter(true)}
              >
                <Text style={styles.buttonText}>Go to Our Resource Center →</Text>
              </Pressable>
            </View>
          </View>
        </View>

      ) : (
        /* --- RESOURCE CENTER WEBVIEW --- */
        <View style={styles.webviewContainer}>
          {/* Header to allow the user to go back to the landing page */}
          <View style={styles.webviewHeader}>
            <Pressable onPress={() => setShowResourceCenter(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textLight} />
              <Text style={styles.backBtnText}>Back to Home</Text>
            </Pressable>
          </View>

          {webviewLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.gold} />
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
    backgroundColor: COLORS.bg,
  },
  landingContainer: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  closeBtnText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  lmmLogo: {
    width: 90,
    height: 90,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 10,
  },
  subTitleTop: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textLight,
    letterSpacing: 2,
  },
  mainTitlePrimary: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.gold,
    textAlign: 'center',
  },
  mainTitleMiddle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textLight,
    marginVertical: -5,
  },
  subTitleBottom: {
    fontSize: 16,
    fontWeight: '800',
    color: '#60a5fa', // Blue text color for "Outreaches & Crusades"
    marginTop: 10,
    letterSpacing: 1,
  },
  ctaCard: {
    backgroundColor: COLORS.blueContainer,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  ctaPrompt: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  ctaSubText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  resourceButton: {
    backgroundColor: COLORS.goldButton,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  webviewHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});