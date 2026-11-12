import { useAppLanguage } from '@/providers/app-language';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { BookPullSurface } from '@/components/ui/book-pull-surface';
import { useElasticRefresh } from '@/hooks/use-elastic-refresh';
import { PullFlatList } from '@/components/ui/pull-scrollables';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { HappyBiteCard } from '@/components/happy-bite-card';
import { InlineState } from '@/components/ui/inline-state';
import { useHappyBites } from '@/providers/happy-bites';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { apiErrorMessage } from '@/lib/api';
import { happyBiteAsBook, HappyBiteAccessError } from '@/lib/happy-bites';
import type { HappyBite } from '@/lib/types';

export default function HappyBitesScreen() {
  const { t } = useAppLanguage();
  const { items, categories, loading, loadingMore, hasMore, error, loadFirst, loadMore } = useHappyBites();
  const { showToast } = useToast();
  const { playEpisode } = usePlayer();
  const [category, setCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await loadFirst(category, true);
    } finally {
      setRefreshing(false);
    }
  };

  const elasticRefresh = useElasticRefresh(refreshing, refresh);
  useFocusEffect(useCallback(() => { void loadFirst(category, true); }, [category, loadFirst]));

  const play = useCallback(async (bite: HappyBite) => {
    try {
      const book = happyBiteAsBook(bite);
      await playEpisode(book, book.episodes[0]);
      router.push('/player');
    } catch (error) {
      if (!(error instanceof HappyBiteAccessError)) showToast(apiErrorMessage(error), false);
    }
  }, [playEpisode, showToast]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-4 py-2">
        <View className="ml-2 flex-1"><Text className="text-[22px] font-black text-[#241F1C] dark:text-[#F8F5F0]">Happy Bites</Text><Text className="text-xs text-[#6B625C] dark:text-[#A8A29E]">{t("Small thoughts. Meaningful changes.")}</Text></View>
      </View>
      <View className="pb-2 pt-1">
        <FlatList horizontal data={categories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4" renderItem={({ item }) => <Pressable onPress={() => setCategory(item)} className={`rounded-full px-4 py-2.5 ${category === item ? 'bg-coral' : 'bg-[#F6F6F6] dark:bg-[#242424]'}`}><Text className={`text-sm font-bold capitalize ${category === item ? 'text-white' : 'text-[#514944] dark:text-[#D0C8C2]'}`}>{item === 'all' ? t("All") : item}</Text></Pressable>} />
      </View>
      <BookPullSurface motion={elasticRefresh} refreshing={refreshing}>
        <PullFlatList
          {...elasticRefresh.scrollProps}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperClassName="gap-3 px-4"
          contentContainerClassName="gap-3 pb-8 pt-2"
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => <HappyBiteCard bite={item} onPress={() => void play(item)} />}
          ListEmptyComponent={refreshing ? <View /> : loading
            ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F25F45" /></View>
            : error
              ? <InlineState icon="cloud-offline-outline" title={t("Couldn’t load Happy Bites")} message={error} actionLabel={t("Try again")} onAction={() => void loadFirst(category, true)} />
              : <InlineState icon="sparkles-outline" title={t("No Happy Bites yet")} message={t("Short, positive audio thoughts will appear here.")} />}
          onEndReached={() => { if (hasMore) void loadMore(); }}
          onEndReachedThreshold={0.45}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-5" color="#F25F45" /> : undefined}
        />
      </BookPullSurface>
    </SafeAreaView>
  );
}
