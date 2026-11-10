import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePlayer } from '@/providers/player';

export function MiniPlayer() {
  const { currentBook, currentEpisode, status, togglePlayback } = usePlayer();

  if (!currentBook) return null;

  const subtitle =
    currentEpisode?.title ||
    currentBook.episodes[0]?.title ||
    'Episode 1';

  return (
    <View className="flex-row items-center border-t border-[#D9D0C8]/60 bg-[#F6F6F6] px-4 py-1 dark:border-[#4A4542]/70 dark:bg-[#242424]">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open player"
        onPress={() => router.push('/player')}
        className="flex-1 flex-row items-center py-1.5 active:opacity-80"
      >
        {currentBook.coverImageUrl ? (
          <Image
            source={{ uri: currentBook.coverImageUrl }}
            contentFit="cover"
            style={{ width: 46, height: 46, borderRadius: 10 }}
          />
        ) : (
          <View className="h-[46px] w-[46px] items-center justify-center rounded-[10px] bg-[#F0EBE8] dark:bg-[#111111]">
            <Ionicons name="musical-notes" size={22} color="#F25F45" />
          </View>
        )}
        <View className="ml-3 flex-1">
          <Text
            numberOfLines={1}
            className="text-[15px] font-bold text-[#241F1C] dark:text-[#F8F5F0]"
          >
            {currentBook.title}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs text-[#6B625C] dark:text-[#A8A29E]"
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
        hitSlop={8}
        onPress={togglePlayback}
        className="h-11 w-11 items-center justify-center active:opacity-70"
      >
        <Ionicons
          name={status.playing ? 'pause-circle' : 'play-circle'}
          size={34}
          color="#F25F45"
        />
      </Pressable>
    </View>
  );
}
