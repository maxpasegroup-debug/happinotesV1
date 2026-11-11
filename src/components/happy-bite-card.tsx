import { useAppMotion } from '@/providers/motion';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { HappyBite } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { usePlayer } from '@/providers/player';
import { hasHappyBiteProAccess } from '@/lib/happy-bite-access';
import { clockTime } from '@/lib/format';

export function HappyBiteCard({ bite, onPress, width }: { bite: HappyBite; onPress: () => void; width?: number }) {
  const { animationsEnabled } = useAppMotion();
  const { user } = useAuth();
  const { loadingHappyBiteId } = usePlayer();
  const locked = bite.accessType === 'premium' && !hasHappyBiteProAccess(user);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${locked ? 'Unlock' : 'Play'} ${bite.title}, ${bite.accessType}`} accessibilityState={{ disabled: loadingHappyBiteId !== null, busy: loadingHappyBiteId === bite.id }} disabled={loadingHappyBiteId !== null} onPress={onPress} style={width ? { width } : undefined} className={`overflow-hidden rounded-2xl border border-[#D9D0C8]/60 bg-white active:opacity-80 dark:border-[#4A4542] dark:bg-[#1B1B1B] ${width ? '' : 'flex-1'}`}>
      <View className="h-[138px] overflow-hidden bg-[#F0EBE8] dark:bg-[#242424]">
        {bite.thumbnailUrl ? <Image source={{ uri: bite.thumbnailUrl }} contentFit="cover" transition={animationsEnabled ? 150 : 0} style={{ width: '100%', height: '100%' }} /> : <View className="flex-1 items-center justify-center"><Ionicons name="sparkles" size={36} color="#F25F45" /></View>}
        <View className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1"><Text className="text-[10px] font-extrabold text-white">{bite.accessType === 'premium' ? 'PREMIUM' : 'FREE'}</Text></View>
        <View className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-coral">{loadingHappyBiteId === bite.id ? <ActivityIndicator color="#fff" /> : <Ionicons name={locked ? 'lock-closed' : 'play'} size={20} color="#fff" />}</View>
      </View>
      <View className="p-3.5">
        <Text numberOfLines={2} className="text-[15px] font-extrabold leading-5 text-[#241F1C] dark:text-[#F8F5F0]">{bite.title}</Text>
        <View className="mt-2 flex-row items-center"><Ionicons name="time-outline" size={14} color="#A8A29E" /><Text className="ml-1 text-xs text-[#6B625C] dark:text-[#A8A29E]">{clockTime(bite.durationSeconds)}</Text><Text className="mx-2 text-xs text-[#A8A29E]">·</Text><Text numberOfLines={1} className="flex-1 text-xs capitalize text-[#6B625C] dark:text-[#A8A29E]">{bite.category}</Text></View>
      </View>
    </Pressable>
  );
}
