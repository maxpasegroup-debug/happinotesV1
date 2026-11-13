import { useAppLanguage } from '@/providers/app-language';
import { Pressable, Share, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-theme-scheme';
import { usePlayer } from '@/providers/player';
import { useBooks } from '@/providers/books';
import { useToast } from '@/providers/toast';
import { InlineState } from '@/components/ui/inline-state';
import { clockTime } from '@/lib/format';

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const ink = colorScheme === 'dark' ? '#F8F5F0' : '#241F1C';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="items-center rounded-xl px-3 py-2 active:opacity-70"
    >
      <Ionicons name={icon} size={23} color={ink} />
      <Text className="mt-1 text-[13px] text-[#241F1C] dark:text-[#F8F5F0]">
        {label}
      </Text>
    </Pressable>
  );
}

export default function PlayerScreen() {
  const { t } = useAppLanguage();
  const {
    currentBook,
    currentEpisode,
    status,
    togglePlayback,
    playNext,
    playPrevious,
    seek,
  } = usePlayer();
  const { library, savingIds, addToCollection, removeFromCollection } = useBooks();
  const { showToast } = useToast();
  const { colorScheme } = useColorScheme();
  const ink = colorScheme === 'dark' ? '#F8F5F0' : '#241F1C';

  if (!currentBook) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
        <View className="flex-row items-center px-2 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close player")}
            hitSlop={8}
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
          >
            <Ionicons name="chevron-down" size={26} color="#A8A29E" />
          </Pressable>
          <Text className="ml-1 text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{t("Audio Only")}
          </Text>
        </View>
        <InlineState
          icon="headset-outline"
          title={t("Nothing is playing")}
          message={t("Choose a story to start listening.")}
          actionLabel={t("Browse stories")}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const episodes =
    currentBook.episodes.length > 0
      ? currentBook.episodes
      : currentBook.audioUrl
        ? [
            {
              title: 'Episode 1',
              description: '',
              audioUrl: currentBook.audioUrl,
              order: 0,
            },
          ]
        : [];
  const episode = currentEpisode ?? episodes[0] ?? null;
  const index = Math.max(
    0,
    episodes.findIndex(
      (item) =>
        item.audioUrl === episode?.audioUrl && item.title === episode?.title,
    ),
  );

  const total = status.duration || 0;
  const position = Math.min(status.currentTime || 0, total || status.currentTime || 0);
  const sliderValue = total > 0 ? Math.min(1, Math.max(0, position / total)) : 0;
  const remaining = Math.max(0, total - (status.currentTime || 0));
  const saved = library.some((item) => item.id === currentBook.id);

  const toggleSaved = async () => {
    const error = saved
      ? await removeFromCollection(currentBook)
      : await addToCollection(currentBook);
    showToast(
      error ??
        (saved ? 'Removed from library' : 'Saved to library'),
      error == null,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center px-2 py-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Close player")}
          hitSlop={8}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons name="chevron-down" size={26} color="#A8A29E" />
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{t("Audio Only")}
        </Text>
      </View>

      <View className="flex-1 px-5 pb-6 pt-3">
        <View className="flex-1 overflow-hidden rounded-[18px] bg-[#242424]">
          {currentBook.coverImageUrl ? (
            <Image
              source={{ uri: currentBook.coverImageUrl }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="headset" size={80} color="#A8A29E" />
            </View>
          )}
        </View>

        <Text className="mt-[18px] text-[13px] uppercase text-[#A8A29E]">
          {t(currentBook.accessType === 'free' ? 'Free' : 'Premium')} · {t('Episode {{number}}', { number: index + 1 })} /{' '}
          {episodes.length}
        </Text>
        <Text
          numberOfLines={2}
          className="mt-1.5 text-[24px] font-extrabold leading-7 text-[#241F1C] dark:text-[#F8F5F0]"
        >
          {episode?.title ?? currentBook.title}
        </Text>
        {episode?.description ? (
          <Text
            numberOfLines={2}
            className="mt-1 text-[14px] text-[#241F1C] dark:text-[#F8F5F0]"
          >
            {episode.description}
          </Text>
        ) : null}

        <View className="mt-3">
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={0}
            maximumValue={1}
            value={sliderValue}
            disabled={total <= 0}
            minimumTrackTintColor="#F25F45"
            maximumTrackTintColor={colorScheme === 'dark' ? '#2C2C2C' : '#F0EBE8'}
            thumbTintColor="#F25F45"
            onSlidingComplete={(value) => void seek(total * value)}
          />
          <View className="flex-row justify-between">
            <Text className="text-xs text-[#A8A29E]">
              {clockTime(status.currentTime || 0)}
            </Text>
            <Text className="text-xs text-[#A8A29E]">-{clockTime(remaining)}</Text>
          </View>
        </View>

        <View className="mt-2 flex-row items-center">
          <View className="flex-1 items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Previous episode")}
              onPress={() => void playPrevious()}
              className="h-12 w-12 items-center justify-center active:opacity-70"
            >
              <Ionicons name="play-skip-back" size={34} color={ink} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? t("Pause") : t("Play")}
            onPress={togglePlayback}
            className="h-[76px] w-[76px] items-center justify-center active:opacity-80"
          >
            <Ionicons
              name={status.playing ? 'pause-circle' : 'play-circle'}
              size={72}
              color="#F25F45"
            />
          </Pressable>
          <View className="flex-1 items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Next episode")}
              onPress={() => void playNext()}
              className="h-12 w-12 items-center justify-center active:opacity-70"
            >
              <Ionicons name="play-skip-forward" size={34} color={ink} />
            </Pressable>
          </View>
        </View>

        <View className="mt-3 flex-row flex-wrap items-center justify-evenly gap-3">
          <Action icon="timer-outline" label={t("Timer")} />
          <Action
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            label={saved ? t("Saved") : t("Save")}
            onPress={savingIds.includes(currentBook.id) ? undefined : () => void toggleSaved()}
          />
          <Action
            icon="share-outline"
            label={t("Share")}
            onPress={() =>
              void Share.share({
                message: `${currentBook.title}\n\n${t('Listen on HappiNotes')}`,
              })
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
