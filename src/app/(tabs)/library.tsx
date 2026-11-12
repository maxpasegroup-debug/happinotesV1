import { useAppLanguage } from '@/providers/app-language';
import { useEffect, useState } from 'react';
import {
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBooks } from '@/providers/books';
import { BookCard } from '@/components/ui/book-visuals';
import { GridLoadingSkeleton } from '@/components/ui/skeleton';
import type { Book } from '@/lib/types';
import { BookPullSurface } from '@/components/ui/book-pull-surface';
import { useElasticRefresh } from '@/hooks/use-elastic-refresh';
import { PullFlatList } from '@/components/ui/pull-scrollables';

export default function LibraryTab() {
  const { t } = useAppLanguage();
  const { library, collectionLoading, collectionLoaded, loadCollection } =
    useBooks();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!collectionLoaded && !collectionLoading) {
      void loadCollection();
    }
  }, [collectionLoaded, collectionLoading, loadCollection]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCollection(true);
    } finally {
      setRefreshing(false);
    }
  };

  const cardWidth = (width - 40 - 18) / 2;
  const elasticRefresh = useElasticRefresh(refreshing, refresh);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-1 px-5 pb-3 pt-4">
        <Text className="text-[28px] font-black text-[#241F1C] dark:text-[#F8F5F0]">{t("My Library")}
        </Text>
        <BookPullSurface motion={elasticRefresh} refreshing={refreshing} style={{ marginTop: 16 }}>
          {collectionLoading && library.length === 0 ? (
            <GridLoadingSkeleton className="" sidePadding={40} />
          ) : library.length === 0 ? (
            <View className="flex-1 items-center justify-center pb-16">
              <Ionicons name="bookmark-outline" size={58} color="#A8A29E" />
              <Text className="mt-3.5 text-[15px] text-[#A8A29E]">{t("Your saved books will appear here.")}
              </Text>
            </View>
          ) : (
            <PullFlatList
              {...elasticRefresh.scrollProps}
              data={library}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerClassName="gap-y-[18px] pb-6"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: Book }) => (
                <BookCard
                  book={item}
                  width={cardWidth}
                  onPress={() =>
                    router.push({
                      pathname: '/book/[id]',
                      params: { id: item.id },
                    })
                  }
                />
              )}
            />
          )}
        </BookPullSurface>
      </View>
    </SafeAreaView>
  );
}
