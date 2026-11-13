import { useAppLanguage } from '@/providers/app-language';
import { useAppMotion } from '@/providers/motion';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { HappyBite } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { usePlayer } from '@/providers/player';
import { happyBiteAsBook, hasHappyBiteProAccess } from '@/lib/happy-bite-access';
import { clockTime } from '@/lib/format';
import { useBooks } from '@/providers/books';
import { useToast } from '@/providers/toast';

export function HappyBiteCard({ bite, onPress, width }: { bite: HappyBite; onPress: () => void; width?: number }) {
  const { t } = useAppLanguage();
  const { animationsEnabled } = useAppMotion();
  const { user } = useAuth();
  const { loadingHappyBiteId } = usePlayer();
  const { library, savingIds, toggleCollection } = useBooks();
  const { showToast } = useToast();
  const book = happyBiteAsBook(bite);
  const saved = library.some((item) => item.id === book.id);
  const saving = savingIds.includes(book.id);
  const toggleSaved = async () => {
    const error = await toggleCollection(book);
    showToast(error ?? (saved ? 'Removed from library' : 'Saved to library'), error == null);
  };
  const locked = bite.accessType === 'premium' && !hasHappyBiteProAccess(user);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t(locked ? 'Unlock' : 'Play')} ${bite.title}, ${t(bite.accessType === 'premium' ? 'Premium' : 'Free')}`} accessibilityState={{ disabled: loadingHappyBiteId !== null, busy: loadingHappyBiteId === bite.id }} disabled={loadingHappyBiteId !== null} onPress={onPress} style={width ? { width } : undefined} className={`overflow-hidden rounded-2xl border border-[#D9D0C8]/60 bg-white active:opacity-80 dark:border-[#4A4542] dark:bg-[#1B1B1B] ${width ? '' : 'flex-1'}`}>
      <View className="h-[138px] overflow-hidden bg-[#F0EBE8] dark:bg-[#242424]">
        {bite.thumbnailUrl ? <Image source={{ uri: bite.thumbnailUrl }} contentFit="cover" transition={animationsEnabled ? 150 : 0} style={{ width: '100%', height: '100%' }} /> : <View className="flex-1 items-center justify-center"><Ionicons name="sparkles" size={36} color="#F25F45" /></View>}
        <View className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1"><Text className="text-[10px] font-extrabold text-white">{bite.accessType === 'premium' ? t("PREMIUM") : t("FREE")}</Text></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(saved ? 'Remove {{title}} from library' : 'Save {{title}} to library', { title: bite.title })}
          accessibilityState={{ selected: saved, disabled: saving, busy: saving }}
          disabled={saving}
          hitSlop={7}
          onPress={(event) => { event.stopPropagation(); void toggleSaved(); }}
          className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-lg bg-black/65"
        >
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? '#F25F45' : '#FFFFFF'} />}
        </Pressable>
        <View className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-coral">{loadingHappyBiteId === bite.id ? <ActivityIndicator color="#fff" /> : <Ionicons name={locked ? 'lock-closed' : 'play'} size={20} color="#fff" />}</View>
      </View>
      <View className="p-3.5">
        <Text numberOfLines={2} className="text-[15px] font-extrabold leading-5 text-[#241F1C] dark:text-[#F8F5F0]">{bite.title}</Text>
        <View className="mt-2 flex-row items-center"><Ionicons name="time-outline" size={14} color="#A8A29E" /><Text className="ml-1 text-xs text-[#6B625C] dark:text-[#A8A29E]">{clockTime(bite.durationSeconds)}</Text><Text className="mx-2 text-xs text-[#A8A29E]">·</Text><Text numberOfLines={1} className="flex-1 text-xs capitalize text-[#6B625C] dark:text-[#A8A29E]">{bite.category}</Text></View>
      </View>
    </Pressable>
  );
}
