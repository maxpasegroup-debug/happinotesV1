import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppMotion } from '@/providers/motion';

function dismissKeyboard() { Keyboard.dismiss(); }

function useDismissPan(enabled: boolean, drag: SharedValue<number>, closing: SharedValue<boolean>, motion: SharedValue<boolean>, dismiss: () => void, scrollY?: SharedValue<number>) {
  return usePanGesture({
    enabled,
    activeOffsetY: 6,
    failOffsetY: -6,
    failOffsetX: [-20, 20],
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      if (closing.get() || (scrollY && scrollY.get() > 2) || event.numberOfPointers !== 1) GestureStateManager.fail(event.handlerTag);
    },
    onActivate: (event) => {
      'worklet';
      cancelAnimation(drag);
      drag.set(Math.max(0, event.translationY));
      scheduleOnRN(dismissKeyboard);
    },
    onUpdate: (event) => {
      'worklet';
      if (event.numberOfPointers !== 1 || (scrollY && scrollY.get() > 2)) {
        GestureStateManager.fail(event.handlerTag);
        return;
      }
      if (!closing.get()) drag.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled && !closing.get() && (event.translationY >= 64 || (event.translationY >= 20 && event.velocityY > 700))) {
        // Lock before crossing to JS, so a second touch cannot interrupt dismissal.
        closing.set(true);
        scheduleOnRN(dismiss);
      }
    },
    onFinalize: () => {
      'worklet';
      if (!closing.get()) drag.set(motion.get() ? withSpring(0, { damping: 22, stiffness: 260, mass: 0.8, reduceMotion: ReduceMotion.System }) : 0);
    },
  });
}

/** Native header drag plus optional list-at-top drag, both updating on the UI thread. */
export function useSheetDismiss(visible: boolean, onClose: (() => void) | undefined, dismissDistance: number) {
  const { animationsEnabled } = useAppMotion();
  const drag = useSharedValue(0);
  const closing = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const motion = useSharedValue(animationsEnabled);
  const mounted = useRef(true);
  const closeRequested = useRef(false);
  const generation = useRef(0);
  const latest = useRef({ visible, onClose, dismissDistance, animationsEnabled });
  useEffect(() => {
    latest.current = { visible, onClose, dismissDistance, animationsEnabled };
    motion.set(animationsEnabled);
  }, [visible, onClose, dismissDistance, animationsEnabled, motion]);

  const reset = useCallback(() => {
    generation.current++;
    closeRequested.current = false;
    cancelAnimation(drag);
    closing.set(false);
    drag.set(0);
    scrollY.set(0);
  }, [closing, drag, scrollY]);
  useEffect(() => { reset(); }, [visible, reset]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelAnimation(drag); };
  }, [drag]);

  const finishClose = useCallback((token: number) => {
    if (mounted.current && token === generation.current && closeRequested.current && latest.current.visible) {
      generation.current++;
      latest.current.onClose?.();
    }
  }, []);
  const dismiss = useCallback(() => {
    const settings = latest.current;
    if (!mounted.current || closeRequested.current || !settings.visible || !settings.onClose) return;
    closeRequested.current = true;
    closing.set(true);
    Keyboard.dismiss();
    cancelAnimation(drag);
    const token = generation.current;
    if (!settings.animationsEnabled) { finishClose(token); return; }
    drag.set(withTiming(settings.dismissDistance, { duration: 180, reduceMotion: ReduceMotion.System }, (finished) => {
      if (finished) scheduleOnRN(finishClose, token);
    }));
  }, [closing, drag, finishClose]);

  const enabled = visible && Boolean(onClose);
  const gesture = useDismissPan(enabled, drag, closing, motion, dismiss);
  const contentGesture = useDismissPan(enabled, drag, closing, motion, dismiss, scrollY);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.set(event.nativeEvent.contentOffset.y);
  }, [scrollY]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  return {
    dismiss, reset, gesture, contentGesture, style,
    scrollProps: { onScroll, simultaneousWith: contentGesture, disallowInterruption: false, scrollEventThrottle: 16, bounces: false, overScrollMode: 'never' as const },
  };
}
