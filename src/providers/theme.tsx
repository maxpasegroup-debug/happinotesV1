import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { colorScheme } from 'nativewind';
import { readPreference, savePreference } from '@/lib/api';

type ThemeContextValue = {
  dark: boolean;
  ready: boolean;
  setDark: (value: boolean) => Promise<void>;
  toggle: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The app defaults to dark, exactly like Flutter's ThemeController, and the
 * selected mode is persisted per device.
 *
 * `dark` in this provider is the single source of truth: the root View carries
 * the `dark` class (tailwind `darkMode: 'class'`), so every `dark:` variant
 * resolves from it. Never read `useColorScheme()` inside an effect dependency
 * list — NativeWind rebuilds that object on every render, which re-triggers
 * the effect forever and hangs the app on a blank screen.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(true);
  const [ready, setReady] = useState(false);

  // Best-effort: keeps RN's Appearance in sync so native surfaces (the status
  // bar, modal chrome) agree. Older runtimes lack the setter, and the explicit
  // `dark` class alone already styles every `dark:` variant in the app.
  const applyScheme = useCallback((value: boolean) => {
    try {
      colorScheme.set(value ? 'dark' : 'light');
    } catch {
      // Appearance.setColorScheme is unavailable here.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await readPreference('theme_mode').catch(() => null);
      if (!mounted) return;
      const next = stored ? stored === 'dark' : true;
      setDarkState(next);
      applyScheme(next);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [applyScheme]);

  const setDark = useCallback(
    async (value: boolean) => {
      setDarkState(value);
      applyScheme(value);
      await savePreference('theme_mode', value ? 'dark' : 'light').catch(
        () => {},
      );
    },
    [applyScheme],
  );

  const toggle = useCallback(() => setDark(!dark), [dark, setDark]);

  const value = useMemo(
    () => ({ dark, ready, setDark, toggle }),
    [dark, ready, setDark, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is missing.');
  return value;
}
