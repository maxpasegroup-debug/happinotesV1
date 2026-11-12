import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { readPreference, savePreference } from '@/lib/api';
import { isAppLanguage, translate, type AppLanguage, type TranslationValues } from '@/lib/translations';

type AppLanguageSettings = {
  language: AppLanguage;
  ready: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (text: string, values?: TranslationValues) => string;
};
const Context = createContext<AppLanguageSettings | null>(null);

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('english');
  const [ready, setReady] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void readPreference('app_language').catch(() => null).then((stored) => {
      if (!active) return;
      if (isAppLanguage(stored)) setLanguageState(stored);
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    // UI language is local to this device and independent of listening preferences.
    writes.current = writes.current.catch(() => {}).then(() => savePreference('app_language', next));
    return writes.current;
  }, []);
  const t = useCallback((text: string, values?: TranslationValues) => translate(language, text, values), [language]);
  const value = useMemo(() => ({ language, ready, setLanguage, t }), [language, ready, setLanguage, t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error('AppLanguageProvider is missing.');
  return value;
}
