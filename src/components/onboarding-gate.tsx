import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useBooks } from '@/providers/books';
import { readPreference, savePreference } from '@/lib/api';
import { LanguageSheet } from '@/components/ui/language-sheet';

/**
 * Mirrors Flutter's first-run language picker followed by the one-time
 * subscription prompt. Preference keys are stored per user, exactly like the
 * Flutter implementation.
 */
export function OnboardingGate() {
  const { user, updateLanguage } = useAuth();
  const { loadBooks } = useBooks();
  const [sheetVisible, setSheetVisible] = useState(false);
  const startedFor = useRef<string | null>(null);

  const offerSubscription = useCallback(async () => {
    if (!user || user.role === 'admin' || user.subscriptionActive) return;
    const key = `subscription_prompt_seen_${user.id}`;
    const seen = await readPreference(key);
    if (seen === '1') return;
    await savePreference(key, '1');
    router.push('/subscription?prompt=1');
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    if (startedFor.current === user.id) return;
    startedFor.current = user.id;
    let active = true;
    void (async () => {
      const key = `language_prompt_seen_${user.id}`;
      const seen = await readPreference(key).catch(() => null);
      if (!active) return;
      if (seen === '1') {
        await offerSubscription();
        return;
      }
      await savePreference(key, '1');
      if (active) setSheetVisible(true);
    })();
    return () => {
      active = false;
    };
  }, [offerSubscription, user]);

  const handleSelect = useCallback(
    async (language: string) => {
      setSheetVisible(false);
      try {
        await updateLanguage(language);
        await loadBooks({
          language: language === 'all' ? undefined : language,
          forceRefresh: true,
        });
      } catch {
        // The auth layer surfaces API errors elsewhere; onboarding continues.
      }
      await offerSubscription();
    },
    [loadBooks, offerSubscription, updateLanguage],
  );

  const handleClose = useCallback(() => {
    setSheetVisible(false);
    void offerSubscription();
  }, [offerSubscription]);

  return (
    <LanguageSheet
      visible={sheetVisible}
      selected={user?.languagePreference ?? 'all'}
      onSelect={(language) => void handleSelect(language)}
      onClose={handleClose}
    />
  );
}
