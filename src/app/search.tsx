import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppLanguage } from '@/providers/app-language';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { BookCard } from '@/components/ui/book-visuals';
import { HappyBiteCard } from '@/components/happy-bite-card';
import { GridLoadingSkeleton } from '@/components/ui/skeleton';
import { InlineState } from '@/components/ui/inline-state';
import { apiErrorMessage, fetchBooks } from '@/lib/api';
import { happyBiteAsBook, HappyBiteAccessError } from '@/lib/happy-bites';
import { fetchDiscoverBites, filterDiscover, type DiscoverFilter } from '@/lib/discover';
import type { Book, HappyBite } from '@/lib/types';

const filters = [
  { value: 'books', label: 'Books', icon: 'book-outline' },
  { value: 'bites', label: 'Bites', icon: 'sparkles-outline' },
  { value: 'both', label: 'Both', icon: 'grid-outline' },
] as const;

export default function SearchScreen() {
  const { t } = useAppLanguage();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { playEpisode } = usePlayer();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoverFilter>(params.filter === 'books' || params.filter === 'bites' ? params.filter : 'both');
  const [books, setBooks] = useState<Book[]>([]);
  const [bites, setBites] = useState<HappyBite[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [bitesLoading, setBitesLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [bitesError, setBitesError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // Keep Discover's catalog local: typing never changes Home's shared feed.
  useFocusEffect(useCallback(() => {
    let active = true;
    setBooksLoading(true);
    setBitesLoading(true);
    setBooksError(null);
    setBitesError(null);
    void fetchBooks({}).then((items) => { if (active) setBooks(items); })
      .catch((error) => { if (active) { setBooks([]); setBooksError(apiErrorMessage(error)); } })
      .finally(() => { if (active) setBooksLoading(false); });
    void fetchDiscoverBites(() => active).then((items) => { if (active) setBites(items); })
      .catch((error) => { if (active) { setBites([]); setBitesError(apiErrorMessage(error)); } })
      .finally(() => { if (active) setBitesLoading(false); });
    return () => { active = false; };
  // Retry deliberately restarts the focus subscription and cancels its old requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]));

  const results = useMemo(() => filterDiscover(books, bites, filter, query), [books, bites, filter, query]);
  const loading = (filter !== 'bites' && booksLoading) || (filter !== 'books' && bitesLoading);
  const errors = [filter !== 'bites' && booksError ? `${t('Books')}: ${booksError}` : '', filter !== 'books' && bitesError ? `${t('Bites')}: ${bitesError}` : ''].filter(Boolean);
  const cardWidth = Math.max(120, (width - 50) / 2);
  const placeholder = filter === 'books' ? 'Search books' : filter === 'bites' ? 'Search Happy Bites' : 'Search books and Happy Bites';
  const playBite = async (bite: HappyBite) => {
    try {
      const book = happyBiteAsBook(bite);
      await playEpisode(book, book.episodes[0]);
      router.push('/player');
    } catch (error) {
      if (!(error instanceof HappyBiteAccessError)) showToast(apiErrorMessage(error), false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-2 py-2">
        <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} hitSlop={8} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10">
          <Ionicons name="arrow-back" size={24} color="#A8A29E" />
        </Pressable>
        <Text className="ml-1 text-[26px] font-black text-[#241F1C] dark:text-[#F8F5F0]">{t('Discover')}</Text>
      </View>
      <View className="px-4 pt-2">
        <View className="h-[52px] flex-row items-center rounded-2xl border border-[#D9D0C8]/60 bg-[#F6F6F6] px-4 dark:border-[#4A4542] dark:bg-[#242424]">
          <Ionicons name="search" size={20} color="#A8A29E" />
          <TextInput value={query} onChangeText={setQuery} accessibilityLabel={t(placeholder)} placeholder={t(placeholder)} placeholderTextColor="#A8A29E" autoCapitalize="none" returnKeyType="search" className="ml-3 flex-1 py-3 text-base text-[#241F1C] dark:text-[#F8F5F0]" />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} hitSlop={8} onPress={() => setQuery('')} className="p-1"><Ionicons name="close-circle" size={20} color="#A8A29E" /></Pressable> : null}
        </View>
        <View className="mt-3 flex-row gap-2 rounded-2xl bg-[#F6F6F6] p-1.5 dark:bg-[#242424]">
          {filters.map((option) => (
            <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={t(option.label)} accessibilityState={{ selected: filter === option.value }} onPress={() => setFilter(option.value)} className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2 ${filter === option.value ? 'bg-coral' : ''}`}>
              <Ionicons name={option.icon} size={17} color={filter === option.value ? '#FFFFFF' : '#A8A29E'} />
              <Text className={`text-sm font-bold ${filter === option.value ? 'text-white' : 'text-[#6B625C] dark:text-[#A8A29E]'}`}>{t(option.label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="mt-4 flex-1">
        {errors.length > 0 ? <View className="mx-4 mb-3 rounded-xl bg-[#FFF3EF] p-3 dark:bg-[#291C18]"><Text accessibilityRole="alert" className="text-sm text-[#6B625C] dark:text-[#A8A29E]">{errors.join('\n')}</Text><Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} className="self-start py-2"><Text className="font-bold text-coral">{t('Try again')}</Text></Pressable></View> : null}
        {loading && results.length === 0 ? <GridLoadingSkeleton /> : results.length === 0 ? (
          <InlineState icon="search-outline" title={t(errors.length ? 'Search is unavailable' : 'No results found')} message={t(errors.length ? 'Try again' : 'Try another title.')} />
        ) : (
          <FlatList data={results} keyExtractor={({ kind, item }) => `${kind}:${item.id}`} numColumns={2} columnWrapperStyle={{ justifyContent: 'space-between', alignItems: 'flex-start' }} contentContainerClassName="gap-y-4 px-4 pb-8" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
            ListFooterComponent={loading ? <ActivityIndicator className="py-4" color="#F25F45" /> : undefined}
            renderItem={({ item: result }) => (
              <View style={{ width: cardWidth }}>
                <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8B827C] dark:text-[#A8A29E]">{t(result.kind === 'book' ? 'Audiobooks' : 'Happy Bites')}</Text>
                {result.kind === 'book' ? <BookCard book={result.item} width={cardWidth} onPress={() => router.push({ pathname: '/book/[id]', params: { id: result.item.id } })} /> : <HappyBiteCard bite={result.item} width={cardWidth} onPress={() => void playBite(result.item)} />}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
