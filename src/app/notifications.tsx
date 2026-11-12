import { useAppLanguage } from '@/providers/app-language';
import { useAppMotion } from '@/providers/motion';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
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
import { USE_NATIVE_DRIVER } from '@/lib/app-environment';
import { notificationAge } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

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
  const { animationsEnabled } = useAppMotion();
  const { items, loading, error, load } = useNotifications();
  const { resolveBook } = useBooks();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(520, Math.max(320, height - insets.top - 40));
  const [sheetDrag] = useState(() => new Animated.Value(0));
  const handlePan = useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        sheetDrag.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 70 || gesture.vy > 0.5) {
          if (!animationsEnabled) { router.back(); return; }
          Animated.timing(sheetDrag, {
            toValue: sheetHeight,
            duration: 170,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start(() => router.back());
        } else {
          if (!animationsEnabled) { sheetDrag.setValue(0); return; }
          Animated.spring(sheetDrag, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
      },
    }),
    [animationsEnabled, sheetDrag, sheetHeight],
  );

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
        onPress={() => router.back()}
      />
      <Animated.View
        style={{
          height: sheetHeight,
          paddingBottom: Math.max(insets.bottom, 20),
          transform: [{ translateY: sheetDrag }],
        }}
        className="rounded-t-3xl bg-white px-5 pt-3 dark:bg-[#1B1B1B]"
      >
        <View
          {...handlePan.panHandlers}
          className="-mx-5 -mt-3 px-5 pt-3 pb-1"
        >
          <View className="h-1 w-10 self-center rounded-full bg-[#A8A29E]" />
          <Text className="mt-4 text-[22px] font-black text-[#241F1C] dark:text-[#F8F5F0]">{t("Notifications")}
          </Text>
        </View>
        <ScrollView
          className="mt-3 flex-1"
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {loading && items.length === 0 ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#F25F45" />
            </View>
          ) : items.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-center text-[15px] text-[#A8A29E]">
                {error ?? t("No notifications yet.")}
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
        </ScrollView>
      </Animated.View>
    </View>
  );
}
