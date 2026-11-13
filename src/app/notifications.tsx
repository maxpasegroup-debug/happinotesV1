import { useAppLanguage } from '@/providers/app-language';
import { useEffect } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBooks } from '@/providers/books';
import { useNotifications } from '@/providers/notifications';
import { notificationAge } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { BellPullSurface } from '@/components/ui/bell-pull-surface';
import { PullScrollView } from '@/components/ui/pull-scrollables';
import { useElasticRefresh } from '@/hooks/use-elastic-refresh';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSheetDismiss } from '@/hooks/use-sheet-dismiss';

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'new_episode') return 'headset';
  if (type === 'new_book') return 'sparkles';
  return 'notifications-outline';
}

function NotificationTile({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress?: () => void;
}) {
  const { t } = useAppLanguage();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="flex-row py-2.5 active:opacity-70"
    >
      {notification.imageUrl ? (
        <View className="h-12 w-12 overflow-hidden rounded-full bg-[#F0EBE8] dark:bg-[#242424]">
          <Image
            source={{ uri: notification.imageUrl }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-full bg-coral/15">
          <Ionicons name={iconFor(notification.type)} size={22} color="#F25F45" />
        </View>
      )}
      <View className="ml-4 flex-1">
        <Text className="text-[16px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
          {notification.title}
        </Text>
        <Text className="mt-0.5 text-[14px] leading-[19px] text-[#241F1C] dark:text-[#F8F5F0]">
          {notification.message}
        </Text>
        <Text className="mt-1 text-[12px] text-[#6B625C] dark:text-[#A8A29E]">
          {notificationAge(notification.createdAt, t)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { t } = useAppLanguage();
  const { items, loading, error, load } = useNotifications();
  const elasticRefresh = useElasticRefresh(loading, () => load(true));
  const { resolveBook } = useBooks();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(520, Math.max(320, height - insets.top - 40));
  const sheet = useSheetDismiss(true, () => router.back(), sheetHeight);

  useEffect(() => {
    void load(true);
  }, [load]);

  const openBook = async (bookId: string) => {
    const book = await resolveBook(bookId);
    if (!book) return;
    router.replace({ pathname: '/book/[id]', params: { id: bookId } });
  };

  return (
    <View className="flex-1 justify-end bg-black/40">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Close notifications")}
        className="flex-1"
        onPress={sheet.dismiss}
      />
      <Animated.View
        accessibilityViewIsModal onAccessibilityEscape={sheet.dismiss}
        style={[{
          height: sheetHeight,
          paddingBottom: Math.max(insets.bottom, 20),
        }, sheet.style]}
        className="rounded-t-3xl bg-white px-5 pt-3 dark:bg-[#1B1B1B]"
      >
        <GestureDetector gesture={sheet.gesture}>
        <View
          collapsable={false}
          className="-mx-5 -mt-3 px-5 pt-3 pb-1"
        >
          <View className="h-1 w-10 self-center rounded-full bg-[#A8A29E]" />
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="flex-1 text-[22px] font-black text-[#241F1C] dark:text-[#F8F5F0]">{t('Notifications')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Refresh notifications')} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
            onPress={() => void load(true)} className="h-11 w-11 items-center justify-center rounded-full bg-coral/10 active:opacity-70">
            <Ionicons name="refresh-outline" size={21} color="#F25F45" />
          </Pressable>
        </View>
        </View>
        </GestureDetector>
        <BellPullSurface motion={elasticRefresh} refreshing={loading}>
        <PullScrollView
          {...elasticRefresh.scrollProps}
          className="mt-3 flex-1"
          contentContainerStyle={{ paddingBottom: 68, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View accessibilityLiveRegion="polite" className="mb-3 rounded-xl bg-coral/10 p-3">
              <Text className="text-sm text-[#6B625C] dark:text-[#D0C8C2]">{error}</Text>
              <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load(true)} className="min-h-11 justify-center">
                <Text className="font-bold text-coral">{t('Try again')}</Text>
              </Pressable>
            </View>
          ) : null}
          {loading && items.length === 0 ? (
            <View className="flex-1" />
          ) : items.length === 0 && !error ? (
            <View className="items-center py-12">
              <Text className="text-center text-[15px] text-[#A8A29E]">
                {t("No notifications yet.")}
              </Text>
            </View>
          ) : (
            items.map((notification) => (
              <NotificationTile
                key={notification.id}
                notification={notification}
                onPress={
                  notification.bookId
                    ? () => void openBook(notification.bookId!)
                    : undefined
                }
              />
            ))
          )}
        </PullScrollView>
        </BellPullSurface>
      </Animated.View>
    </View>
  );
}
