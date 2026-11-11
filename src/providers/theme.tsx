import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { colorScheme } from "nativewind";
import { readPreference, savePreference } from "@/lib/api";
type ThemeContextValue = {
  dark: boolean;
  ready: boolean;
  setDark: (value: boolean) => Promise<void>;
  toggle: () => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(true);
  const [ready, setReady] = useState(false);
  const selected = useRef(true);
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const applyScheme = useCallback((value: boolean) => {
    try {
      colorScheme.set(value ? "dark" : "light");
    } catch {}
  }, []);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await readPreference("theme_mode").catch(() => null);
      if (!mounted) return;
      const next = stored ? stored === "dark" : true;
      selected.current = next;
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
      selected.current = value;
      setDarkState(value);
      applyScheme(value);
      // Serialize persistence so a slower previous write cannot undo the last tap.
      pendingSave.current = pendingSave.current
        .then(() => savePreference("theme_mode", value ? "dark" : "light"))
        .catch(() => {});
      await pendingSave.current;
    },
    [applyScheme],
  );
  const toggle = useCallback(() => setDark(!selected.current), [setDark]);
  const value = useMemo(
    () => ({ dark, ready, setDark, toggle }),
    [dark, ready, setDark, toggle],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is missing.");
  return value;
}
