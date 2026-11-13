import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAppMotion } from '@/providers/motion';
import type { useElasticRefresh } from '@/hooks/use-elastic-refresh';

export function BellPullSurface({ motion, refreshing, children }: {
  motion: ReturnType<typeof useElasticRefresh>;
  refreshing: boolean;
  children: ReactNode;
}) {
  const { animationsEnabled } = useAppMotion();
  // The motion provider also incorporates the system's Reduce Motion setting.
  const animate = animationsEnabled;
  const ring = useSharedValue(0);
  const distance = motion.pullDistance;
  useEffect(() => {
    cancelAnimation(ring);
    ring.set(0);
    if (refreshing && animate) {
      ring.set(withRepeat(withSequence(
        withTiming(-16, { duration: 85 }),
        withTiming(16, { duration: 130 }),
        withTiming(-10, { duration: 110 }),
        withTiming(10, { duration: 100 }),
        withTiming(0, { duration: 100 }),
        withTiming(0, { duration: 220 }),
      ), -1, false, undefined, ReduceMotion.System));
    }
    return () => { cancelAnimation(ring); };
  }, [animate, refreshing, ring]);
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: animate ? Math.max(distance.get(), refreshing ? 56 : 0) : refreshing ? 56 : 0 }],
  }));
  const bellStyle = useAnimatedStyle(() => {
    const reveal = refreshing ? 1 : animate ? Math.min(1, Math.max(0, distance.get() / 56)) : 0;
    return {
      opacity: reveal,
      transform: [
        { translateY: animate ? -28 * (1 - reveal) : 0 },
        { scale: animate ? 0.7 + 0.3 * reveal : 1 },
        { rotateZ: `${animate ? ring.get() + (refreshing ? 0 : Math.sin(reveal * Math.PI * 3) * 10) : 0}deg` },
      ],
    };
  });
  return (
    <GestureDetector gesture={motion.gesture}>
      <View collapsable={false} style={styles.container} accessibilityState={{ busy: refreshing }}>
        <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.bell, bellStyle]}>
          <Ionicons name="notifications" size={29} color="#F25F45" />
        </Animated.View>
        <Animated.View style={[styles.page, pageStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, overflow: 'hidden' },
  page: { flex: 1, minHeight: 0 },
  bell: { position: 'absolute', top: 7, left: '50%', marginLeft: -20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', transformOrigin: '50% 15%' },
});
