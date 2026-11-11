import { useAppMotion } from '@/providers/motion';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/providers/theme';

const glide = { duration: 280, dampingRatio: 1, overshootClamping: true, reduceMotion: ReduceMotion.System };
const fade = { duration: 320, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System };

export function AppearanceToggle() {
  const { animationsEnabled } = useAppMotion();
  const { dark, ready, setDark } = useAppTheme();
  const target = useRef(dark);
  const progress = useSharedValue(dark ? 1 : 0);
  const position = useSharedValue(dark ? 1 : 0);
  const pressed = useSharedValue(1);

  const animateTo = useCallback((next: boolean) => {
    progress.set(animationsEnabled ? withTiming(next ? 1 : 0, fade) : next ? 1 : 0);
    position.set(animationsEnabled ? withSpring(next ? 1 : 0, glide) : next ? 1 : 0);
  }, [position, progress, animationsEnabled]);

  // Sync restored preferences without restarting an animation begun by a tap.
  useEffect(() => {
    if (target.current !== dark || !animationsEnabled) {
      target.current = dark;
      animateTo(dark);
    }
  }, [animateTo, dark, animationsEnabled]);

  const switchTheme = () => {
    const next = !target.current;
    target.current = next;
    // Start the UI-thread animation before the app updates its theme classes.
    animateTo(next);
    void setDark(next);
  };

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], ['#F5E8D6', '#252C43']),
    borderColor: interpolateColor(progress.get(), [0, 1], ['#E8D6BC', '#46516E']),
    transform: [{ scale: pressed.get() }],
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * 32 }],
    backgroundColor: interpolateColor(progress.get(), [0, 1], ['#FFFFFF', '#E5E9F4']),
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ rotate: `${position.get() * 100}deg` }, { scale: 1 - progress.get() * 0.3 }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ rotate: `${(1 - position.get()) * -60}deg` }, { scale: 0.7 + progress.get() * 0.3 }],
  }));
  const dayStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const nightStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 4 }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: dark, disabled: !ready }}
      accessibilityHint={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      disabled={!ready}
      onPress={switchTheme}
      onPressIn={() => pressed.set(animationsEnabled ? withTiming(0.95, { duration: 90, reduceMotion: ReduceMotion.System }) : 1)}
      onPressOut={() => pressed.set(animationsEnabled ? withSpring(1, { ...glide, duration: 180 }) : 1)}
      style={styles.touchTarget}
    >
      <Animated.View pointerEvents="none" style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.day, dayStyle]}>
          <Ionicons name="moon-outline" size={16} color="#A38760" />
        </Animated.View>
        <Animated.View style={[styles.night, nightStyle]}>
          <View style={[styles.star, { left: 10, top: 10, width: 3, height: 3 }]} />
          <View style={[styles.star, { left: 19, top: 18, width: 4, height: 4 }]} />
          <View style={[styles.star, { left: 9, top: 26, width: 2, height: 2 }]} />
        </Animated.View>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Animated.View style={[styles.icon, sunStyle]}><Ionicons name="sunny" size={20} color="#BD7A16" /></Animated.View>
          <Animated.View style={[styles.icon, moonStyle]}><Ionicons name="moon" size={19} color="#465374" /></Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: { width: 76, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { width: 72, height: 40, borderRadius: 20, borderWidth: 1 },
  day: { position: 'absolute', right: 10, top: 11 },
  night: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  star: { position: 'absolute', borderRadius: 2, backgroundColor: '#C2CBE4' },
  thumb: { position: 'absolute', top: 3, left: 3, width: 32, height: 32, borderRadius: 16, shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  icon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
