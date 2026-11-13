import { useAppLanguage } from '@/providers/app-language';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useBooks } from '@/providers/books';
import { useNotifications } from '@/providers/notifications';
import { useHappyBites } from '@/providers/happy-bites';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { BookCard, Cover } from '@/components/ui/book-visuals';
import { HappyBiteCard } from '@/components/happy-bite-card';
import { SkeletonBox } from '@/components/ui/skeleton';
import { InlineState, SectionTitle } from '@/components/ui/inline-state';
import { languageLabel } from '@/lib/format';
import type { Book, HappyBite } from '@/lib/types';
import { apiErrorMessage } from '@/lib/api';
import { BookPullSurface } from '@/components/ui/book-pull-surface';
import { useElasticRefresh } from '@/hooks/use-elastic-refresh';
import { PullScrollView } from '@/components/ui/pull-scrollables';
import { LanguageSheet } from '@/components/ui/language-sheet';
import { happyBiteAsBook, HappyBiteAccessError } from '@/lib/happy-bites';
export default function HomeTab() {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { user, updateLanguage } = useAuth();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const {
    books,
    upcoming,
    loading,
    error,
    hasLoaded,
    loadBooks,
    library,
    toggleCollection,
  } = useBooks();
  const { items: happyBites, loading: happyBitesLoading, error: happyBitesError, loadFirst: loadHappyBites } = useHappyBites();
  const { playEpisode } = usePlayer();
  const { showToast } = useToast();
  const [savingBook, setSavingBook] = useState<string | null>(null);
  const { load: loadNotifications } = useNotifications();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const preference = user?.languagePreference ?? 'all';
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const activePreference = showAllLanguages ? 'all' : preference;
  const selectListeningLanguage = async (language: string) => {
    if (savingLanguage) return;
    setSavingLanguage(true);
    try {
      await updateLanguage(language);
      setShowAllLanguages(false);
      setLanguageOpen(false);
      await loadBooks({ language: language === 'all' ? undefined : language, forceRefresh: true });
    } catch (exception) {
      showToast(apiErrorMessage(exception), false);
    } finally {
      setSavingLanguage(false);
    }
  };
  const matches = useCallback(
    (book: Book) =>
      activePreference === 'all' ||
      book.language.toLowerCase() === activePreference.toLowerCase(),
    [activePreference],
  );
  const visibleBooks = useMemo(() => books.filter(matches), [books, matches]);
  const upcomingBooks = useMemo(
    () => upcoming.filter((book) => book.status === 'coming_soon' && matches(book)),
    [upcoming, matches],
  );
  const latestBooks = useMemo(
    () => [...visibleBooks].sort((a, b) =>
      (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0),
    ).slice(0, 8),
    [visibleBooks],
  );

  useEffect(() => {
    if (!hasLoaded) {
      void loadBooks();
    }
  }, [hasLoaded, loadBooks]);

  useFocusEffect(useCallback(() => { void loadHappyBites('all'); }, [loadHappyBites]));

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Keep the pull gesture busy until both sections finish, even if one fails.
      await Promise.allSettled([loadBooks({ forceRefresh: true }), loadHappyBites('all', true)]);
    } finally {
      setRefreshing(false);
    }
  };

  const elasticRefresh = useElasticRefresh(refreshing, refresh);

  const openBook = (book: Book) => {
    router.push({ pathname: '/book/[id]', params: { id: book.id } });
  };

  const toggleSaved = async (book: Book) => {
    if (savingBook !== null) return;
    setSavingBook(book.id);
    const wasSaved = library.some((item) => item.id === book.id);
    try {
      const failure = await toggleCollection(book);
      showToast(failure ?? (wasSaved ? 'Removed from your library' : 'Saved to your library'), failure == null);
    } finally {
      setSavingBook(null);
    }
  };

  const playHappyBite = async (bite: HappyBite) => {
    try {
      const biteBook = happyBiteAsBook(bite);
      await playEpisode(biteBook, biteBook.episodes[0]);
      router.push('/player');
    } catch (error) {
      if (!(error instanceof HappyBiteAccessError)) showToast(apiErrorMessage(error), false);
    }
  };

  const renderShelf = (items: Book[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-4"
      className="mt-3"
    >
      {items.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onPress={() => openBook(book)}
          textOpacity={0.8}
          saved={library.some((item) => item.id === book.id)}
          saving={savingBook !== null}
          onToggleSaved={() => void toggleSaved(book)}
        />
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]" style={{ minHeight: 0 }}>
      <BookPullSurface motion={elasticRefresh} refreshing={refreshing}>
      <PullScrollView
        {...elasticRefresh.scrollProps}
        className="flex-1"
        style={{ minHeight: 0 }}
        contentContainerClassName="px-4 pt-3"
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-coral">
            <Ionicons name="headset" size={24} color="#FFFFFF" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[22px] font-black leading-7 text-[#241F1C] dark:text-[#F8F5F0]">
              HappiNotes
            </Text>
            <Text className="text-xs text-[#A8A29E]">{t("Listen. Learn. Feel better.")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Notifications")}
            hitSlop={8}
            onPress={() => {
              void loadNotifications(true);
              router.push('/notifications');
            }}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color="#A8A29E"
            />
          </Pressable>
        </View>

        <View className="mt-[18px] flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Search books and stories")}
          onPress={() => router.navigate('/search')}
          className="min-h-[52px] flex-1 flex-row items-center rounded-2xl bg-[#F6F6F6] px-4 py-3 active:opacity-80 dark:bg-[#242424]"
        >
          <Ionicons name="search" size={20} color="#A8A29E" />
          <Text numberOfLines={2} className="ml-3 flex-1 text-[15px] text-[#A8A29E]">{t("Search books and stories")}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Choose listening language")} disabled={savingLanguage}
          onPress={() => setLanguageOpen(true)}
          className="min-h-[52px] max-w-[120px] items-center justify-center rounded-2xl bg-[#FFF0E8] px-3 py-2 dark:bg-[#352720]">
          <Ionicons name="language-outline" size={20} color="#F25F45" />
          <Text numberOfLines={1} className="mt-1 text-[11px] font-bold text-coral">{t(activePreference === 'all' ? 'All languages' : languageLabel(activePreference))}</Text>
        </Pressable>
        </View>

        <View className="mt-6">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1">
              <SectionTitle>{t("Audiobooks")}</SectionTitle>
              <Text className="mt-1 text-[13px] text-[#6B625C] dark:text-[#A8A29E]">{t("The newest additions to your listening list.")}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("See all audiobooks")} onPress={() => router.navigate('/search')} className="py-3 pl-3">
              <Text className="text-sm font-extrabold text-coral">{t("See all")}</Text>
            </Pressable>
          </View>
          {!hasLoaded || loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4">
              {[0, 1, 2].map((item) => <View key={item} className="gap-2"><SkeletonBox width={140} height={194} radius={12} /><SkeletonBox width={120} height={14} /></View>)}
            </ScrollView>
          ) : error ? (
            <InlineState
              icon="cloud-offline-outline"
              title={t("Couldn’t load stories")}
              message={error}
              actionLabel={t("Try again")}
              onAction={() => void loadBooks({ forceRefresh: true })}
            />
          ) : visibleBooks.length === 0 ? (
            books.length > 0 ? (
              <InlineState
                icon="language-outline"
                title={t("No stories in this language yet")}
                message={t('Nothing is published in {{language}} yet. The catalogue has {{count}} stories in other languages.', { language: t(languageLabel(preference)), count: books.length })}
                actionLabel={t("Show all languages")}
                onAction={() => setShowAllLanguages(true)}
              />
            ) : (
              <InlineState
                icon="book-outline"
                title={t("Your next story is on its way")}
                message={t("New audio stories will appear here.")}
              />
            )
          ) : (
            renderShelf(latestBooks)
          )}
        </View>
        <View className="mt-7">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <SectionTitle>Happy Bites</SectionTitle>
              <Text className="mt-1 text-[13px] text-[#6B625C] dark:text-[#A8A29E]">{t("Small thoughts. Meaningful changes.")}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("See all Happy Bites")} onPress={() => router.navigate('/(tabs)/happy-bites')} className="py-3 pl-3">
              <Text className="text-sm font-extrabold text-coral">{t("See all")}</Text>
            </Pressable>
          </View>
          {happyBitesLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3" className="mt-3" accessibilityState={{ busy: true }}>
              {[0, 1, 2].map((item) => (
                <View key={item} style={{ width: Math.min(248, width - 64) }} className="gap-3">
                  <SkeletonBox height={160} radius={16} />
                  <SkeletonBox width="80%" height={16} />
                  <SkeletonBox width={70} height={12} />
                </View>
              ))}
            </ScrollView>
          ) : happyBitesError ? (
            <InlineState icon="cloud-offline-outline" title={t("Couldn’t load Happy Bites")} message={happyBitesError} actionLabel={t("Try again")} onAction={() => void loadHappyBites('all', true)} />
          ) : happyBites.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3" className="mt-3">
              {happyBites.slice(0, 8).map((bite) => <HappyBiteCard key={bite.id} bite={bite} width={Math.min(248, width - 64)} onPress={() => void playHappyBite(bite)} />)}
            </ScrollView>
          ) : (
            <View className="mt-3 flex-row items-center rounded-2xl border border-coral/20 bg-[#FFF3EF] p-5 dark:bg-[#291C18]">
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-coral/15"><Ionicons name="sparkles-outline" size={25} color="#F25F45" /></View>
              <View className="flex-1">
                <Text className="font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{t("A little inspiration is on its way")}</Text>
                <Text className="mt-1 text-sm leading-5 text-[#6B625C] dark:text-[#A8A29E]">{t("Free audio bites, about a minute each. New thoughts will appear here.")}</Text>
              </View>
            </View>
          )}
        </View>

        {upcomingBooks.length > 0 ? (
          <View className="mt-7">
            <SectionTitle>{t("Coming Soon")}</SectionTitle>
            <Text className="mt-1 text-[13px] text-[#6B625C] dark:text-[#A8A29E]">{t("A little preview of what’s on the way.")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4" className="mt-3">
              {upcomingBooks.map((book) => (
                <View key={book.id} style={{ width: 140 }} accessible accessibilityLabel={`${book.title}, coming soon`}>
                  <View className="h-[194px] overflow-hidden rounded-xl">
                    <Cover book={book} className="h-full w-full" />
                    <View className="absolute bottom-2 left-2 right-2 flex-row items-center justify-center gap-1 rounded-lg bg-black/70 px-2 py-1.5">
                      <Ionicons name="time-outline" size={13} color="#FFFFFF" />
                      <Text className="text-[10px] font-extrabold uppercase tracking-wide text-white">{t("Coming soon")}</Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} className="mt-2 text-sm font-bold leading-[17px] text-[#241F1C]/80 dark:text-[#F8F5F0]/80">{book.title}</Text>
                  {book.language ? <Text className="mt-1 text-[11px] text-[#6B625C] dark:text-[#A8A29E]">{t(languageLabel(book.language))}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </PullScrollView>
      </BookPullSurface>
      <LanguageSheet visible={languageOpen} selected={activePreference} disabled={savingLanguage}
        onSelect={(language) => void selectListeningLanguage(language)} onClose={() => setLanguageOpen(false)} />
    </SafeAreaView>
  );
}
