import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemeText, ThemeView } from '@/components/ui/theme-motion';
import { usePlayer } from '@/providers/player';

export function MiniPlayer() {
  const { currentBook, currentEpisode, status, togglePlayback } = usePlayer();

  if (!currentBook) return null;

  const subtitle =
    currentEpisode?.title ||
    currentBook.episodes[0]?.title ||
    'Episode 1';

  return (
    <ThemeView lightBackground="#F6F6F6" darkBackground="#242424" lightBorder="rgba(217,208,200,0.6)" darkBorder="rgba(74,69,66,0.7)" className="flex-row items-center border-t px-4 py-1">
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
          <ThemeView lightBackground="#F0EBE8" darkBackground="#111111" className="h-[46px] w-[46px] items-center justify-center rounded-[10px]">
            <Ionicons name="musical-notes" size={22} color="#F25F45" />
          </ThemeView>
        )}
        <View className="ml-3 flex-1">
          <ThemeText
            numberOfLines={1}
            lightColor="#241F1C" darkColor="#F8F5F0" className="text-[15px] font-bold"
          >
            {currentBook.title}
          </ThemeText>
          <ThemeText
            numberOfLines={1}
            lightColor="#6B625C" darkColor="#A8A29E" className="mt-0.5 text-xs"
          >
            {subtitle}
          </ThemeText>
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
    </ThemeView>
  );
}
