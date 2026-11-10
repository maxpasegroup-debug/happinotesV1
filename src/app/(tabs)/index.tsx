import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useBooks } from '@/providers/books';
import { useNotifications } from '@/providers/notifications';
import { useToast } from '@/providers/toast';
import { BookCard, FeaturedCard } from '@/components/ui/book-visuals';
import { HomeLoadingSkeleton } from '@/components/ui/skeleton';
import { InlineState, SectionTitle } from '@/components/ui/inline-state';
import { languageLabel } from '@/lib/format';
import type { Book } from '@/lib/types';

export default function HomeTab() {
  const { user } = useAuth();
  const {
    books,
    upcoming,
    library,
    loading,
    error,
    hasLoaded,
    loadBooks,
    addToCollection,
    removeFromCollection,
  } = useBooks();
  const { showToast } = useToast();
  const { load: loadNotifications } = useNotifications();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [railIndex, setRailIndex] = useState(0);
  const railRef = useRef<FlatList<Book>>(null);

  const preference = user?.languagePreference ?? 'all';
  // Home is filtered by the saved language, exactly like Flutter's HomeTab. If
  // that filter legitimately matches nothing, the screen says so instead of
  // looking like the catalogue failed to load.
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const activePreference = showAllLanguages ? 'all' : preference;
  const matches = useCallback(
    (book: Book) =>
      activePreference === 'all' ||
      book.language.toLowerCase() === activePreference.toLowerCase(),
    [activePreference],
  );
  const visibleBooks = useMemo(() => books.filter(matches), [books, matches]);
  const visibleUpcoming = useMemo(
    () => upcoming.filter(matches),
    [upcoming, matches],
  );
  const freeBooks = useMemo(
    () => visibleBooks.filter((book) => book.accessType === 'free'),
    [visibleBooks],
  );

  useEffect(() => {
    if (!hasLoaded) {
      // The feed is fetched unfiltered; Home filters it by the saved language.
      void loadBooks();
    }
  }, [hasLoaded, loadBooks]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadBooks({ forceRefresh: true });
    } finally {
      setRefreshing(false);
    }
  };

  const openBook = (book: Book) => {
    router.push({ pathname: '/book/[id]', params: { id: book.id } });
  };

  const openComingSoon = (book: Book) => {
    showToast(`${book.title} is coming soon`, true);
  };

  const toggleSaved = async (book: Book) => {
    const saved = library.some((item) => item.id === book.id);
    const message = saved
      ? await removeFromCollection(book)
      : await addToCollection(book);
    showToast(
      message ??
        (saved ? 'Removed from your library' : 'Added to your library'),
      message == null,
    );
  };

  const railWidth = width - 32;
  const railCardWidth = railWidth * 0.73;
  const railHeight = Math.min(374, Math.max(300, width * 0.95));
  const dotCount = Math.min(Math.max(visibleBooks.length, 1), 6);

  const onRailScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / railCardWidth);
    if (index !== railIndex) setRailIndex(Math.max(0, index));
  };

  const renderShelf = (items: Book[], comingSoon = false) => (
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
          onPress={() => (comingSoon ? openComingSoon(book) : openBook(book))}
        />
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-7 pt-3"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor="#F25F45"
            colors={['#F25F45']}
          />
        }
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-coral">
            <Ionicons name="headset" size={24} color="#FFFFFF" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[22px] font-black leading-7 text-[#241F1C] dark:text-[#F8F5F0]">
              HappiNotes
            </Text>
            <Text className="text-xs text-[#A8A29E]">
              Listen. Learn. Feel better.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            onPress={() => {
              // Flutter refreshes the list before opening the sheet.
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search books and stories"
          onPress={() => router.push('/search')}
          className="mt-[18px] h-[52px] flex-row items-center rounded-2xl bg-[#F6F6F6] px-4 active:opacity-80 dark:bg-[#242424]"
        >
          <Ionicons name="search" size={20} color="#A8A29E" />
          <Text className="ml-3 text-[15px] text-[#A8A29E]">
            Search books and stories
          </Text>
        </Pressable>

        <View className="mt-[22px]">
          {!hasLoaded || loading ? (
            <HomeLoadingSkeleton />
          ) : error ? (
            <InlineState
              icon="cloud-offline-outline"
              title="Couldn’t load stories"
              message={error}
              actionLabel="Try again"
              onAction={() => void loadBooks({ forceRefresh: true })}
            />
          ) : visibleBooks.length === 0 && visibleUpcoming.length === 0 ? (
            books.length + upcoming.length > 0 ? (
              <InlineState
                icon="language-outline"
                title="No stories in this language yet"
                message={`Nothing is published in ${languageLabel(
                  preference,
                )} yet. The catalogue has ${
                  books.length
                } ${books.length === 1 ? 'story' : 'stories'} in other languages.`}
                actionLabel="Show all languages"
                onAction={() => setShowAllLanguages(true)}
              />
            ) : (
              <InlineState
                icon="book-outline"
                title="Your next story is on its way"
                message="New audio stories will appear here."
              />
            )
          ) : (
            <>
              {visibleBooks.length > 0 ? (
                <>
                  <View>
                    <FlatList
                      ref={railRef}
                      data={visibleBooks}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={railCardWidth}
                      decelerationRate="fast"
                      onScroll={onRailScroll}
                      scrollEventThrottle={16}
                      renderItem={({ item }) => (
                        <View style={{ width: railCardWidth, height: railHeight }}>
                          <View className="flex-1 px-2.5">
                            <FeaturedCard
                              book={item}
                              width={railCardWidth - 20}
                              height={railHeight}
                              saved={library.some((book) => book.id === item.id)}
                              onPress={() => openBook(item)}
                              onToggleSaved={() => void toggleSaved(item)}
                            />
                          </View>
                        </View>
                      )}
                    />
                  </View>
                  <View className="mt-3 flex-row justify-center">
                    {Array.from({ length: dotCount }, (_, dot) => {
                      const active =
                        dot === Math.min(Math.max(railIndex, 0), dotCount - 1);
                      return (
                        <View
                          key={dot}
                          className={`mx-1 h-2 rounded-full ${
                            active
                              ? 'w-[42px] bg-coral'
                              : 'w-2 bg-[#D9D0C8] dark:bg-[#4A4542]'
                          }`}
                        />
                      );
                    })}
                  </View>

                  <View className="mt-7">
                    <SectionTitle>Recently added</SectionTitle>
                    {renderShelf(visibleBooks)}
                  </View>

                  <View className="mt-6">
                    <SectionTitle>Free to listen</SectionTitle>
                    {renderShelf(freeBooks)}
                  </View>
                </>
              ) : null}

              {visibleUpcoming.length > 0 ? (
                <View className="mt-6">
                  <SectionTitle>Coming soon</SectionTitle>
                  <Text className="mt-1.5 text-[15px] text-[#A8A29E]">
                    New audiobooks being prepared for release.
                  </Text>
                  {renderShelf(visibleUpcoming, true)}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
