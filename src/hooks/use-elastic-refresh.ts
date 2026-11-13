import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppMotion } from '@/providers/motion';

const spring = { damping: 12, stiffness: 190, mass: 0.55, reduceMotion: ReduceMotion.System };
const refreshDistance = 90;

/** Native pan and native scroll recognize together; movement stays on the UI thread. */
export function useElasticRefresh(refreshing: boolean, onRefresh: () => Promise<void>) {
  const { animationsEnabled } = useAppMotion();
  const offset = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const eligible = useSharedValue(false);
  const busy = useSharedValue(refreshing);
  const motionEnabled = useSharedValue(animationsEnabled);
  const shake = useSharedValue(0);
  const finishing = useSharedValue(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const latest = useRef({ animationsEnabled, refreshing, onRefresh });

  useEffect(() => {
    latest.current = { animationsEnabled, refreshing, onRefresh };
  }, [animationsEnabled, refreshing, onRefresh]);

  useEffect(() => {
    motionEnabled.set(animationsEnabled);
    if (!animationsEnabled) {
      cancelAnimation(shake);
      shake.set(0);
      finishing.set(false);
    } else if (finishing.get()) {
      // Keep the hand holding the page until the completion shake ends.
      return;
    }
    busy.set(refreshing || inFlight.current);
    cancelAnimation(offset);
    offset.set(animationsEnabled ? withSpring(refreshing || inFlight.current ? 56 : 0, spring) : 0);
  }, [animationsEnabled, busy, finishing, motionEnabled, offset, refreshing, shake]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelAnimation(offset); cancelAnimation(shake); };
  }, [offset, shake]);

  const refresh = useCallback(async () => {
    if (!mounted.current || inFlight.current) return;
    if (latest.current.refreshing) return;
    inFlight.current = true;
    let completed = false;
    try {
      await latest.current.onRefresh();
      completed = true;
    } catch {
      // Data providers expose failures in the screen's existing error UI.
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        if (completed && latest.current.animationsEnabled) {
          finishing.set(true);
          offset.set(56);
          shake.set(withSequence(
            ReduceMotion.System,
            withTiming(-1, { duration: 55 }),
            withTiming(1, { duration: 85 }),
            withTiming(-0.65, { duration: 70 }),
            withTiming(0.35, { duration: 65 }),
            withTiming(0, { duration: 55 }, (finished) => {
              if (!finished) return;
              finishing.set(false);
              busy.set(false);
              offset.set(withSpring(0, spring));
            }),
          ));
        } else {
          busy.set(false);
          offset.set(latest.current.animationsEnabled ? withSpring(0, spring) : 0);
        }
      }
    }
  }, [busy, finishing, offset, shake]);

  const gesture = usePanGesture({
    activeOffsetY: 6,
    failOffsetY: -6,
    failOffsetX: [-16, 16],
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      eligible.set(scrollY.get() <= 2 && !busy.get() && event.numberOfPointers === 1);
      if (!eligible.get()) GestureStateManager.fail(event.handlerTag);
    },
    onActivate: (event) => {
      'worklet';
      cancelAnimation(offset);
      offset.set(motionEnabled.get() ? 72 * (1 - Math.exp(-Math.max(0, event.translationY) / 120)) : 0);
    },
    onUpdate: (event) => {
      'worklet';
      if (event.numberOfPointers !== 1 || scrollY.get() > 2) {
        eligible.set(false);
        GestureStateManager.fail(event.handlerTag);
        return;
      }
      if (eligible.get()) {
        offset.set(motionEnabled.get() ? 72 * (1 - Math.exp(-Math.max(0, event.translationY) / 120)) : 0);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      const shouldRefresh = !event.canceled && eligible.get() && !busy.get() && event.translationY >= refreshDistance;
      eligible.set(false);
      if (shouldRefresh) {
        // Lock on the UI thread before scheduling the request on the JS thread.
        busy.set(true);
        offset.set(motionEnabled.get() ? withSpring(56, spring) : 0);
        scheduleOnRN(refresh);
      }
    },
    onFinalize: () => {
      'worklet';
      eligible.set(false);
      if (!busy.get()) offset.set(motionEnabled.get() ? withSpring(0, spring) : 0);
    },
  });

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.set(event.nativeEvent.contentOffset.y);
  }, [scrollY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transformOrigin: '50% 0%',
    transform: [
      { translateY: offset.get() },
      { translateX: shake.get() * 3.5 },
      { rotateZ: `${shake.get() * 0.8}deg` },
    ],
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, offset.get() / 40)),
  }));
  const handStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, offset.get() / 18)),
    height: Math.max(0, offset.get()) + 10,
    transform: [{ translateX: shake.get() * 3.5 }],
  }));

  return {
    pullDistance: offset,
    animatedStyle,
    shadeStyle,
    handStyle,
    gesture,
    scrollProps: { onScroll, simultaneousWith: gesture, disallowInterruption: false, scrollEventThrottle: 16, bounces: false, overScrollMode: 'never' as const },
  };
}
