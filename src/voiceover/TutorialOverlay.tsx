import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '@/navigation/ref';
import { colors, radius, type as t } from '@/constants/theme';
import { useVoiceover } from './VoiceoverProvider';
import { TUTORIAL_STEPS, type TutorialRoute } from './tutorial';
import { captionFor } from './logic';
import { VOICEOVERS } from './manifest';

/** Opens the real destination for a tutorial step. Does nothing until the navigator is ready. */
function openRoute(route: TutorialRoute) {
  if (!navigationRef.isReady()) return;
  if (route.kind === 'home') navigationRef.navigate('Tabs', { screen: 'Home' });
  else if (route.kind === 'tab') navigationRef.navigate('Tabs', { screen: route.screen });
  else navigationRef.navigate(route.screen);
}

/**
 * The welcome tour card. It's shown above the app while active. The card takes all touches, so the
 * screen underneath can't be pressed by accident; only its own controls work. Skip is always visible.
 */
export function TutorialOverlay() {
  const v = useVoiceover();
  const insets = useSafeAreaInsets();
  const { active, index } = v.tutorial;
  const step = TUTORIAL_STEPS[index];

  // Move to the step's screen whenever the step changes (deliberate Next/Back/Start).
  useEffect(() => {
    if (active && step) openRoute(step.route);
  }, [active, index, step]);

  if (!active || !step) return null;
  const last = index === TUTORIAL_STEPS.length - 1;
  const narration = captionFor(VOICEOVERS[step.voice]);

  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topRow}>
          <Text style={styles.progress} accessibilityLiveRegion="polite">
            Step {index + 1} of {TUTORIAL_STEPS.length}
          </Text>
          <Pressable onPress={v.skipTutorial} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip tutorial">
            <Text style={styles.skip}>Skip tutorial</Text>
          </Pressable>
        </View>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {TUTORIAL_STEPS.map((s, i) => (
            <View key={s.voice} style={[styles.dot, i <= index && styles.dotOn]} />
          ))}
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={styles.caption}>{step.caption}</Text>
        {narration ? <Text style={styles.narration}>{narration}</Text> : null}

        <View style={styles.row}>
          <Pressable
            onPress={() => {
              v.stop();
              v.play(step.voice);
            }}
            accessibilityRole="button"
            accessibilityLabel="Replay this step"
            style={styles.ghost}
          >
            <Ionicons name="refresh" size={18} color={colors.accent} />
            <Text style={styles.ghostText}>Replay</Text>
          </Pressable>
          <Pressable
            onPress={() => v.setEnabled(!v.enabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: !v.enabled }}
            accessibilityLabel={v.enabled ? 'Mute voice' : 'Unmute voice'}
            style={styles.ghost}
          >
            <Ionicons name={v.enabled ? 'volume-high' : 'volume-mute'} size={18} color={colors.accent} />
            <Text style={styles.ghostText}>{v.enabled ? 'Mute' : 'Unmute'}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={v.previousStep}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
            accessibilityState={{ disabled: index === 0 }}
            style={[styles.secondary, index === 0 && { opacity: 0.4 }]}
          >
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={last ? v.finishTutorial : v.nextStep}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Finish tutorial' : 'Next step'}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{last ? 'Finish' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,0,28,0.55)', justifyContent: 'flex-end', zIndex: 1000, elevation: 1000 },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 12, borderTopWidth: 1, borderColor: 'rgba(245,197,66,0.35)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { ...t.caps, color: colors.accent },
  skip: { ...t.small, color: colors.textMuted, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  title: { ...t.h2, color: colors.text },
  caption: { ...t.body, color: colors.textMuted },
  narration: { ...t.small, color: colors.textSubtle, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 10 },
  ghost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  ghostText: { ...t.small, color: colors.accent, fontWeight: '700' },
  secondary: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  secondaryText: { ...t.body, color: colors.text, fontWeight: '700' },
  primary: { flex: 1.4, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.accent },
  primaryText: { ...t.body, color: colors.onAccent, fontWeight: '800' },
});
