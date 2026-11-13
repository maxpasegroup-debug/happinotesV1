import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { Keyboard, Platform, ScrollView, type ScrollViewProps } from 'react-native';

/** Keep a focused descendant visible after keyboard and form layout changes. */
export function useKeyboardForm() {
  const ref = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const focused = useRef<Parameters<ComponentRef<typeof ScrollView>['scrollResponderScrollNativeHandleToKeyboard']>[0] | null>(null);
  const frame = useRef<number | null>(null);
  const cancelPending = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const revealFocused = useCallback(() => {
    cancelPending();
    if (Platform.OS === 'web') return; // Browser focus scrolling handles the visual viewport.
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      const scroll = ref.current;
      if (input === null || !scroll || !Keyboard.isVisible()) return;
      // The native helper measures the input inside the scroll content, but
      // keyboard coordinates are screen-relative. Include headers/modal placement.
      scroll.measureInWindow((_x, screenY) => {
        if (ref.current !== scroll || focused.current !== input || !Keyboard.isVisible()) return;
        scroll.scrollResponderScrollNativeHandleToKeyboard(input, screenY + 24, true);
      });
    });
  }, [cancelPending]);
  useEffect(() => cancelPending, [cancelPending]);
  const onFocus = useCallback<NonNullable<ScrollViewProps['onFocus']>>((event) => {
    // Host instances avoid legacy numeric measurement on the New Architecture.
    focused.current = typeof event.target === 'object' ? event.target : event.nativeEvent.target;
    revealFocused();
  }, [revealFocused]);
  const onBlur = useCallback(() => {
    focused.current = null;
    cancelPending();
  }, [cancelPending]);

  return {
    ref,
    onFocus,
    onBlur,
    onKeyboardDidShow: revealFocused,
    onKeyboardDidHide: cancelPending,
    onLayout: revealFocused,
    onContentSizeChange: revealFocused,
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: 'on-drag' as const,
  };
}
