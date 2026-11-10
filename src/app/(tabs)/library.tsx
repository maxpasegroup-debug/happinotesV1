import { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
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

export default function LibraryTab() {
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

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-1 px-5 pb-3 pt-4">
        <Text className="text-[28px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
          My Library
        </Text>
        <View className="mt-4 flex-1">
          {collectionLoading && library.length === 0 ? (
            <GridLoadingSkeleton className="" sidePadding={40} />
          ) : library.length === 0 ? (
            <View className="flex-1 items-center justify-center pb-16">
              <Ionicons name="bookmark-outline" size={58} color="#A8A29E" />
              <Text className="mt-3.5 text-[15px] text-[#A8A29E]">
                Your saved books will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={library}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerClassName="gap-y-[18px] pb-6"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void refresh()}
                  tintColor="#F25F45"
                  colors={['#F25F45']}
                />
              }
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
        </View>
      </View>
    </SafeAreaView>
  );
}
