import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { readPreference, savePreference } from '@/lib/api';

type MotionSettings = {
  enabled: boolean;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  ready: boolean;
  setEnabled: (value: boolean) => Promise<void>;
};
const MotionContext = createContext<MotionSettings | null>(null);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Keep navigation instant until the user explicitly enables animations.
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    void readPreference('app_animations').catch(() => null).then((stored) => {
      if (!mounted) return;
      setEnabledState(stored === 'true');
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    // Preserve the last selection even when the switch is tapped quickly.
    pendingSave.current = pendingSave.current.catch(() => {}).then(() => savePreference('app_animations', String(value)));
    return pendingSave.current;
  }, []);
  const animationsEnabled = ready && enabled && !reducedMotion;
  const value = useMemo(() => ({ enabled, animationsEnabled, reducedMotion, ready, setEnabled }), [enabled, animationsEnabled, reducedMotion, ready, setEnabled]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useAppMotion() {
  const settings = useContext(MotionContext);
  if (!settings) throw new Error('MotionProvider is missing.');
  return settings;
}
