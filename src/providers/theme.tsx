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
import { AppState } from "react-native";
import { readPreference, savePreference } from "@/lib/api";
import { isNightTime } from "@/lib/theme-schedule";
type ThemeContextValue = {
  dark: boolean;
  auto: boolean;
  ready: boolean;
  setDark: (value: boolean) => Promise<void>;
  setAuto: (value: boolean) => Promise<void>;
  toggle: () => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(true);
  const [auto, setAutoState] = useState(false);
  const [ready, setReady] = useState(false);
  const selected = useRef(true);
  const automatic = useRef(false);
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
      const isAuto = stored === "auto";
      const next = isAuto ? isNightTime() : stored !== "light";
      automatic.current = isAuto;
      setAutoState(isAuto);
      selected.current = next;
      setDarkState(next);
      applyScheme(next);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [applyScheme]);
  useEffect(() => {
    if (!ready || !auto) return;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      if (!automatic.current) return;
      const next = isNightTime();
      if (selected.current !== next) {
        selected.current = next;
        setDarkState(next);
        applyScheme(next);
      }
    };
    const tick = () => {
      sync();
      // Align to the minute so 06:00/18:00 changes happen on time. Rechecking
      // also picks up clock/time-zone changes while the app stays open.
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    tick();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [auto, ready, applyScheme]);
  const persist = useCallback(async (mode: "dark" | "light" | "auto") => {
    // Serialize persistence so a slower previous write cannot undo the last tap.
    pendingSave.current = pendingSave.current
      .then(() => savePreference("theme_mode", mode))
      .catch(() => {});
    await pendingSave.current;
  }, []);
  const setDark = useCallback(
    async (value: boolean) => {
      automatic.current = false;
      setAutoState(false);
      selected.current = value;
      setDarkState(value);
      applyScheme(value);
      await persist(value ? "dark" : "light");
    },
    [applyScheme, persist],
  );
  const setAuto = useCallback(async (value: boolean) => {
    automatic.current = value;
    setAutoState(value);
    // Turning Auto off keeps the current appearance until the next manual tap.
    const next = value ? isNightTime() : selected.current;
    selected.current = next;
    setDarkState(next);
    applyScheme(next);
    await persist(value ? "auto" : next ? "dark" : "light");
  }, [applyScheme, persist]);
  const toggle = useCallback(() => setDark(!selected.current), [setDark]);
  const value = useMemo(
    () => ({ dark, auto, ready, setDark, setAuto, toggle }),
    [dark, auto, ready, setDark, setAuto, toggle],
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
