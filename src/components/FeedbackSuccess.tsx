import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, type as t } from '@/constants/theme';

const GREEN = '#22C55E';
const CIRCLE = 120;
const STAGE = 200;
const STROKE = 9;

// The tick is two rounded bars meeting at a corner; each grows from its starting end, so it "draws".
// Points are in the circle's own 120 x 120 box: start, corner, end.
const A = { x: 35, y: 62 };
const B = { x: 52, y: 79 };
const C = { x: 87, y: 44 };
const SHORT = Math.hypot(B.x - A.x, B.y - A.y);
const LONG = Math.hypot(C.x - B.x, C.y - B.y);

// Small sparkles around the circle: position in the 200 x 200 stage, size, colour, and the direction they drift.
const SPARKLES = [
  { x: 22, y: 44, size: 16, color: colors.accent, dx: -8, dy: -6 },
  { x: 164, y: 30, size: 13, color: '#FFFFFF', dx: 7, dy: -8 },
  { x: 176, y: 104, size: 15, color: colors.accent, dx: 9, dy: 0 },
  { x: 150, y: 166, size: 12, color: '#FFFFFF', dx: 6, dy: 8 },
  { x: 34, y: 158, size: 14, color: colors.accent, dx: -7, dy: 8 },
  { x: 8, y: 100, size: 11, color: '#FFFFFF', dx: -9, dy: 0 },
];

/** 0..1 mapped to a scale that never reaches exactly zero (a zero scale can stop a view drawing on Android). */
const grow = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] });

interface Props {
  onBack: () => void;
  onSendAnother: () => void;
}

/**
 * The "Thank You!" state shown once Firestore has confirmed the feedback was saved. The circle springs
 * in, a ripple expands, the tick draws itself, a few sparkles twinkle, then the text slides up.
 * With "reduce motion" switched on in the phone's settings, everything simply appears.
 */
export function FeedbackSuccess({ onBack, onSendAnother }: Props) {
  const circle = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const shortBar = useRef(new Animated.Value(0)).current;
  const longBar = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    let running: Animated.CompositeAnimation | null = null;

    const showFinal = () => {
      [circle, shortBar, longBar, text].forEach((v) => v.setValue(1));
      ripple.setValue(1); // fully faded out
      sparkle.setValue(1); // fully faded out
    };

    const play = () => {
      const timing = (v: Animated.Value, duration: number, delay: number, easing = Easing.out(Easing.cubic)) =>
        Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: true });
      running = Animated.parallel([
        Animated.spring(circle, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        timing(ripple, 900, 140),
        timing(shortBar, 150, 330, Easing.in(Easing.quad)),
        timing(longBar, 260, 480),
        timing(sparkle, 1100, 620, Easing.linear),
        timing(text, 420, 720),
      ]);
      running.start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive) return;
        if (reduced) showFinal();
        else play();
      })
      .catch(() => alive && play());
    AccessibilityInfo.announceForAccessibility('Thank You! Your feedback has been successfully received.');

    return () => {
      alive = false;
      running?.stop();
    };
  }, [circle, ripple, shortBar, longBar, sparkle, text]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} accessible accessibilityRole="image" accessibilityLabel="Feedback sent">
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
              transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.6] }) }],
            },
          ]}
        />
        {SPARKLES.map((s, i) => {
          const start = i * 0.08;
          const range = [start, start + 0.25, start + 0.55];
          const clamp = { extrapolate: 'clamp' as const };
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: s.x,
                top: s.y,
                opacity: sparkle.interpolate({ inputRange: range, outputRange: [0, 1, 0], ...clamp }),
                transform: [
                  { translateX: sparkle.interpolate({ inputRange: [start, start + 0.55], outputRange: [0, s.dx], ...clamp }) },
                  { translateY: sparkle.interpolate({ inputRange: [start, start + 0.55], outputRange: [0, s.dy], ...clamp }) },
                  { scale: sparkle.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.6], ...clamp }) },
                ],
              }}
            >
              <Ionicons name="sparkles" size={s.size} color={s.color} />
            </Animated.View>
          );
        })}
        <Animated.View style={[styles.circle, { opacity: circle.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: grow(circle) }] }]}>
          <Animated.View
            style={[
              styles.bar,
              { left: A.x, top: A.y - STROKE / 2, width: SHORT, transform: [{ rotate: '45deg' }, { scaleX: grow(shortBar) }] },
              { opacity: shortBar.interpolate({ inputRange: [0, 0.05], outputRange: [0, 1], extrapolate: 'clamp' }) },
            ]}
          />
          <Animated.View
            style={[
              styles.bar,
              { left: B.x, top: B.y - STROKE / 2, width: LONG, transform: [{ rotate: '-45deg' }, { scaleX: grow(longBar) }] },
              { opacity: longBar.interpolate({ inputRange: [0, 0.05], outputRange: [0, 1], extrapolate: 'clamp' }) },
            ]}
          />
          {/* Rounds the corner where the two bars meet. */}
          <Animated.View
            style={[
              styles.joint,
              { left: B.x - STROKE / 2, top: B.y - STROKE / 2, opacity: longBar.interpolate({ inputRange: [0, 0.05], outputRange: [0, 1], extrapolate: 'clamp' }) },
            ]}
          />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.textBlock,
          { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
        ]}
      >
        <Text style={styles.heading} accessibilityRole="header">
          Thank You!
        </Text>
        <Text style={styles.lead}>Thank you for sharing your feedback!</Text>
        <Text style={styles.body}>
          Your feedback has been successfully received. We appreciate you taking the time to help us make Testimonies of Praise even better.
        </Text>
        <Text style={styles.voice}>Your voice matters to us. ❤️</Text>
        <View style={styles.buttons}>
          <PrimaryButton title="BACK TO T.O.P" icon="arrow-back" onPress={onBack} />
          <PrimaryButton title="SEND ANOTHER FEEDBACK" icon="chatbubble-ellipses-outline" variant="outline" onPress={onSendAnother} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 3, borderColor: GREEN },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bar: { position: 'absolute', height: STROKE, borderRadius: STROKE / 2, backgroundColor: '#FFFFFF', transformOrigin: 'left center' },
  joint: { position: 'absolute', width: STROKE, height: STROKE, borderRadius: STROKE / 2, backgroundColor: '#FFFFFF' },
  textBlock: { alignSelf: 'stretch', alignItems: 'center', gap: 10, marginTop: 8 },
  heading: { ...t.h1, fontSize: 30, lineHeight: 36, color: colors.text, textAlign: 'center' },
  lead: { ...t.h3, color: colors.accent, textAlign: 'center' },
  body: { ...t.body, color: colors.textMuted, textAlign: 'center' },
  voice: { ...t.h3, color: colors.text, textAlign: 'center', marginTop: 4 },
  buttons: { alignSelf: 'stretch', gap: 12, marginTop: 18 },
});
