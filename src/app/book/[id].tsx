import { useAppLanguage } from '@/providers/app-language';
import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useBooks } from '@/providers/books';
import { usePlayer } from '@/providers/player';
import { useToast } from '@/providers/toast';
import { Cover } from '@/components/ui/book-visuals';
import { InlineState } from '@/components/ui/inline-state';
import { apiErrorMessage } from '@/lib/api';
import type { Book, BookEpisode } from '@/lib/types';

function EpisodeRow({
  book,
  episode,
  index,
  locked,
  playingNow,
  onPress,
  onStop,
}: {
  book: Book;
  episode: BookEpisode;
  index: number;
  locked: boolean;
  playingNow: boolean;
  onPress: () => void;
  onStop: () => void;
}) {
  const { t } = useAppLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center py-2 active:opacity-70"
    >
      <View className="mr-3 h-16 w-[52px] overflow-hidden rounded-lg bg-[#F6F6F6] dark:bg-[#242424]">
        {book.coverImageUrl ? (
          <Image
            source={{ uri: book.coverImageUrl }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[15px] font-bold text-[#6B625C] dark:text-[#A8A29E]">
              {index + 1}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-[16px] text-[#241F1C] dark:text-[#F8F5F0]"
        >
          {episode.title}
        </Text>
        {playingNow ? (
          <Text className="mt-1 text-[13px] font-bold text-coral">{t("Playing now")}
          </Text>
        ) : episode.description ? (
          <Text
            numberOfLines={2}
            className="mt-0.5 text-[13px] text-[#6B625C] dark:text-[#A8A29E]"
          >
            {episode.description}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playingNow ? t("Stop episode") : t("Play episode")}
        hitSlop={6}
        onPress={playingNow ? onStop : onPress}
        className="ml-3 h-11 w-11 items-center justify-center active:opacity-60"
      >
        <Ionicons
          name={
            locked
              ? 'lock-closed'
              : playingNow
                ? 'stop'
                : 'play'
          }
          size={22}
          color={locked ? '#A8A29E' : '#F25F45'}
        />
      </Pressable>
    </Pressable>
  );
}

export default function BookDetailScreen() {
  const { t } = useAppLanguage();
  const params = useLocalSearchParams<{ id: string }>();
  const bookId = String(params.id ?? '');
  const { user, refreshUser } = useAuth();
  const {
    findBook,
    loadBooks,
    hasLoaded,
    library,
    addToCollection,
    removeFromCollection,
    collectionLoaded,
    loadCollection,
  } = useBooks();
  const {
    currentBook,
    currentEpisode,
    status,
    playBook,
    playEpisode,
    stop,
  } = usePlayer();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const book = useMemo(() => findBook(bookId), [bookId, findBook]);

  useEffect(() => {
    void refreshUser().catch(() => {
    });
    if (!book) {
      void loadBooks({ forceRefresh: true });
    }
    if (!collectionLoaded) {
      void loadCollection();
    }
  }, [book, collectionLoaded, loadBooks, loadCollection, refreshUser]);

  const saved = library.some((item) => item.id === bookId);
  const isPurchased = user?.purchasedBookIds.includes(bookId) ?? false;
  const hasSubscription = user?.subscriptionActive === true;
  const requiresSubscription =
    !!book &&
    !isPurchased &&
    !hasSubscription &&
    (book.priceInr > 0 || book.accessType === 'premium');
  const isPlaying = !!book && currentBook?.id === book.id && status.playing;

  const toggleSaved = useCallback(async () => {
    if (!book) return;
    const error = saved
      ? await removeFromCollection(book)
      : await addToCollection(book);
    showToast(
      error ??
        (saved ? 'Removed from your library' : 'Saved to your library'),
      error == null,
    );
  }, [addToCollection, book, removeFromCollection, saved, showToast]);

  const openEpisode = useCallback(
    async (episode: BookEpisode) => {
      if (!book) return;
      if (requiresSubscription || !episode.audioUrl) {
        showToast(
          requiresSubscription
            ? 'Subscribe to listen to this story.'
            : 'This episode is not available yet.',
          false,
        );
        return;
      }
      try {
        await playEpisode(book, episode);
        router.push('/player');
      } catch (exception) {
        showToast(
          exception instanceof Error ? exception.message : 'Could not play this audio.',
          false,
        );
      }
    },
    [book, playEpisode, requiresSubscription, showToast],
  );

  const handlePrimary = useCallback(async () => {
    if (!book) return;
    if (requiresSubscription) {
      let refreshed = user;
      try {
        refreshed = await refreshUser();
      } catch (exception) {
        showToast(apiErrorMessage(exception), false);
        return;
      }
      if (refreshed?.purchasedBookIds.includes(book.id)) return;
      if (refreshed?.subscriptionActive) return;
      if (!refreshed) {
        showToast('Sign in to subscribe.', false);
        return;
      }
      router.push('/subscription');
      return;
    }
    if (isPlaying) {
      await stop();
      return;
    }
    try {
      await playBook(book);
    } catch (exception) {
      showToast(
        exception instanceof Error ? exception.message : 'Could not play this audio.',
        false,
      );
    }
  }, [
    book,
    isPlaying,
    playBook,
    refreshUser,
    requiresSubscription,
    showToast,
    stop,
    user,
  ]);

  if (!book) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
        <View className="flex-row items-center px-2 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Go back")}
            hitSlop={8}
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
          >
            <Ionicons name="arrow-back" size={24} color="#A8A29E" />
          </Pressable>
        </View>
        {hasLoaded ? (
          <InlineState
            icon="book-outline"
            title={t("Story unavailable")}
            message={t("This book could not be found. Please refresh the catalogue.")}
            actionLabel={t("Try again")}
            onAction={() => void loadBooks({ forceRefresh: true })}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#F25F45" size="large" />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const coverWidth = Math.min(175, Math.max(128, width * 0.42));
  const episodes = book.episodes;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-[#111111]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-28"
        showsVerticalScrollIndicator={false}
      >
        <View className="h-[360px] w-full overflow-hidden bg-[#242424]">
          {book.coverImageUrl ? (
            <>
              <Image
                source={{ uri: book.coverImageUrl }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
              />
              <View className="absolute inset-0 bg-black/40" />
            </>
          ) : null}
          <View className="absolute inset-0 items-center justify-center">
            <View
              style={{
                width: coverWidth,
                height: coverWidth * 1.4,
                borderRadius: 14,
                shadowColor: '#000',
                shadowOpacity: 0.55,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <Cover
                book={book}
                radius={14}
                className="h-full w-full"
                large
              />
            </View>
          </View>
          <View
            className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-2"
            style={{ paddingTop: insets.top + 4 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Go back")}
              hitSlop={8}
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-black/35 active:bg-black/50"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                saved ? t("Remove from library") : t("Save to library")
              }
              hitSlop={8}
              onPress={() => void toggleSaved()}
              className="h-11 w-11 items-center justify-center rounded-full bg-black/35 active:bg-black/50"
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={23}
                color={saved ? '#F25F45' : '#FFFFFF'}
              />
            </Pressable>
          </View>
        </View>

        <View className="px-5 pt-6">
          <Text className="text-[28px] font-extrabold leading-8 text-[#241F1C] dark:text-[#F8F5F0]">
            {book.title}
          </Text>
          <Text className="mt-2 text-[13px] uppercase text-[#A8A29E]">
            {book.language.toUpperCase()} •{' '}
            {book.accessType === 'premium' ? t("Premium") : t("Free")}
          </Text>

          <View className="mt-3.5 flex-row">
            <View
              className={`flex-row items-center rounded-full border px-3.5 py-2 ${
                isPurchased || hasSubscription
                  ? 'border-[#16803C]/35 bg-[#16803C]/10'
                  : requiresSubscription
                    ? 'border-coral/35 bg-coral/10'
                    : 'border-[#16803C]/35 bg-[#16803C]/10'
              }`}
            >
              <Ionicons
                name={
                  isPurchased || hasSubscription
                    ? 'shield-checkmark'
                    : requiresSubscription
                      ? 'pricetag-outline'
                      : 'checkmark-circle-outline'
                }
                size={17}
                color={
                  requiresSubscription && !isPurchased && !hasSubscription
                    ? '#F25F45'
                    : '#16803C'
                }
              />
              <Text
                className={`ml-2 text-[13px] font-extrabold ${
                  requiresSubscription && !isPurchased && !hasSubscription
                    ? 'text-coral'
                    : 'text-[#16803C]'
                }`}
              >
                {isPurchased
                  ? t("Purchased")
                  : hasSubscription
                    ? t("Subscribed")
                    : requiresSubscription
                      ? t("Subscription required")
                      : t("Free")}
              </Text>
            </View>
          </View>

          {requiresSubscription ? (
            <View className="mt-3.5 flex-row items-center rounded-[14px] border border-coral/35 bg-coral/10 px-3.5 py-3">
              <Ionicons name="lock-closed-outline" size={20} color="#F25F45" />
              <Text className="ml-2.5 flex-1 text-[14px] font-bold leading-5 text-[#241F1C] dark:text-[#F8F5F0]">{t("Premium story · A monthly subscription unlocks all premium stories while active.")}
              </Text>
            </View>
          ) : null}

          <Text className="mt-5 text-[15px] leading-[23px] text-[#241F1C] dark:text-[#F8F5F0]">
            {book.description}
          </Text>

          {episodes.length > 0 ? (
            <View className="mt-7">
              <Text className="mb-2 text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
                {t('{{count}} episodes available', { count: episodes.length })}
              </Text>
              {episodes.map((episode, index) => {
                const current =
                  currentEpisode?.audioUrl === episode.audioUrl &&
                  currentEpisode?.title === episode.title;
                return (
                  <EpisodeRow
                    key={`${episode.order}-${episode.title}-${index}`}
                    book={book}
                    episode={episode}
                    index={index}
                    locked={requiresSubscription || !episode.audioUrl}
                    playingNow={
                      isPlaying && currentBook?.id === book.id && current
                    }
                    onPress={() => void openEpisode(episode)}
                    onStop={() => void stop()}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        className="border-t border-[#D9D0C8]/50 bg-white px-4 pt-3 dark:border-[#4A4542]/60 dark:bg-[#111111]"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!requiresSubscription && book.audioUrl === '' && episodes.length === 0}
          onPress={() => void handlePrimary()}
          className={`min-h-[54px] flex-row items-center justify-center gap-2 rounded-[15px] bg-coral px-5 py-3.5 active:opacity-80 ${
            !requiresSubscription && book.audioUrl === '' && episodes.length === 0
              ? 'opacity-50'
              : ''
          }`}
        >
          <Ionicons
            name={isPlaying ? 'stop' : 'play'}
            size={22}
            color="#FFFFFF"
          />
          <Text className="text-[15px] font-extrabold text-white">
            {requiresSubscription
              ? t("View plans")
              : isPlaying
                ? t("Stop listening")
                : t("Start listening")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
