import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/constants/theme';
import { track } from '@/analytics';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MESSAGES } from '@/utils/errors';

interface Props {
  videoId: string;
  label: string;
}

// YouTube's player rejects requests with no (or an untrustworthy) Referer/origin — "Error 153".
// Giving the WebView a real https baseUrl, matched by the iframe's referrerpolicy, fixes it.
const ORIGIN = 'https://testimoniesofpraise.app';

const html = (id: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;background:#000;height:100%}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe src="https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(ORIGIN)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>`;

/** Plays a YouTube video or live stream via an embedded player (YouTube's own web player, not native controls). */
export function YouTubePlayer({ videoId, label }: Props) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      {failed ? (
        <ErrorState
          compact
          message={MESSAGES.video}
          onRetry={() => {
            setFailed(false);
            setLoading(true);
            setKey((k) => k + 1);
          }}
        />
      ) : (
        <>
          <WebView
            key={key}
            source={{ html: html(videoId), baseUrl: ORIGIN }}
            originWhitelist={['*']}
            style={StyleSheet.absoluteFill}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            onLoadEnd={() => {
              setLoading(false);
              track('live_play', { contentId: videoId });
            }}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
          {loading ? (
            <View style={styles.loading} pointerEvents="none">
              <LoadingSpinner size={36} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
});
