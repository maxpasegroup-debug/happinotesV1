import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useAdmin } from '@/providers/admin';
import { usePlayer } from '@/providers/player';
import { useBooks } from '@/providers/books';
import { useToast } from '@/providers/toast';
import { DashboardLoadingSkeleton } from '@/components/ui/skeleton';
import { ActionButton } from '@/components/ui/action-button';
import { ChoiceField, Field } from '@/components/ui/field';

const TABS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: 'Dashboard', icon: 'grid-outline', active: 'grid' },
  { label: 'Books', icon: 'library-outline', active: 'library' },
  { label: 'Users', icon: 'people-outline', active: 'people' },
  { label: 'Notify', icon: 'notifications-outline', active: 'notifications' },
];

export default function AdminScreen() {
  const { user, logout } = useAuth();
  const {
    stats,
    books,
    users,
    tab,
    loading,
    busy,
    error,
    setTab,
    loadAll,
    newBook,
    editBook,
    removeBook,
    uploadNotificationImage,
    notifyUsers,
    notificationImageUrl,
  } = useAdmin();
  const { stop } = usePlayer();
  const { reset: resetBooks } = useBooks();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!user || user.role !== 'admin') {
    return <Redirect href={user ? '/(tabs)' : '/auth'} />;
  }

  const signOut = async () => {
    await stop();
    await logout();
    resetBooks();
    router.replace('/auth');
  };

  const confirmDelete = (book: Record<string, any>) => {
    Alert.alert(
      'Delete book?',
      `${book.title ?? ''} and its chapters will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await removeBook(String(book._id));
            showToast(
              result.ok ? 'Book deleted' : result.error ?? 'Delete failed',
              result.ok,
            );
          },
        },
      ],
    );
  };

  const openMenu = (book: Record<string, any>) => {
    Alert.alert(String(book.title ?? 'Book'), undefined, [
      {
        text: 'Edit',
        onPress: () => {
          editBook(book);
          router.push('/admin/book-editor');
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(book),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const sendNotification = async () => {
    const result = await notifyUsers(title, message, target);
    showToast(
      result.ok ? 'Notification sent' : result.error ?? 'Could not send',
      result.ok,
    );
  };

  const metrics = [
    { label: 'Users', value: stats.totalUsers ?? 0, icon: 'people' },
    {
      label: 'Premium',
      value: stats.activePremiumSubscribers ?? 0,
      icon: 'diamond',
    },
    {
      label: 'Live books',
      value: stats.totalBooksPublished ?? 0,
      icon: 'book',
    },
    {
      label: 'Chapters',
      value: stats.totalChaptersUploaded ?? 0,
      icon: 'musical-notes',
    },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <View className="flex-row items-center border-b border-[#D9D0C8]/50 px-4 py-2.5 dark:border-[#4A4542]/60">
        <View className="flex-1">
          <Text className="text-xl font-black text-[#241F1C] dark:text-[#F8F5F0]">
            HappiNotes Admin
          </Text>
          <Text className="text-xs text-[#6B625C] dark:text-[#A8A29E]">
            Editorial control
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          disabled={loading}
          hitSlop={8}
          onPress={() => void loadAll()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons name="refresh" size={23} color="#A8A29E" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          hitSlop={8}
          onPress={() => void signOut()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Ionicons name="log-out-outline" size={23} color="#A8A29E" />
        </Pressable>
      </View>

      <View className="flex-1">
        {loading ? (
          <DashboardLoadingSkeleton />
        ) : error && books.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
              {error}
            </Text>
            <ActionButton
              label="Retry"
              onPress={() => void loadAll()}
              className="mt-3 min-w-[120px]"
            />
          </View>
        ) : (
          <>
            {/* Flutter keeps all four admin tabs mounted (IndexedStack) so
                scroll positions survive tab switches. */}
            <View
              className="flex-1"
              style={{ display: tab === 0 ? 'flex' : 'none' }}
            >
          <ScrollView
            contentContainerClassName="px-5 pb-8 pt-5"
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => void loadAll()}
                tintColor="#F25F45"
                colors={['#F25F45']}
              />
            }
          >
            <Text className="text-[28px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
              Dashboard
            </Text>
            <Text className="mt-1.5 text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
              Everything happening across HappiNotes.
            </Text>
            <View className="mt-5 flex-row flex-wrap justify-between gap-y-3">
              {metrics.map((metric) => (
                <View
                  key={metric.label}
                  className="w-[48%] rounded-[14px] border border-[#D9D0C8]/50 p-4 dark:border-[#4A4542]"
                >
                  <Ionicons name={metric.icon} size={23} color="#F25F45" />
                  <Text className="mt-4 text-[25px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
                    {String(metric.value)}
                  </Text>
                  <Text
                    numberOfLines={2}
                    className="mt-0.5 text-[14px] text-[#241F1C] dark:text-[#F8F5F0]"
                  >
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-4 flex-row items-center rounded-[14px] bg-[#F6F6F6] p-4 dark:bg-[#242424]">
              <Ionicons name="trending-up" size={23} color="#A8A29E" />
              <View className="ml-4 flex-1">
                <Text className="text-[15px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">
                  Most listened
                </Text>
                <Text className="mt-0.5 text-[14px] text-[#6B625C] dark:text-[#A8A29E]">
                  {String(stats.mostListenedBook ?? 'Not available')}
                </Text>
              </View>
            </View>
          </ScrollView>
            </View>
            <View
              className="flex-1"
              style={{ display: tab === 1 ? 'flex' : 'none' }}
            >
          <Pressable accessibilityRole="button" onPress={() => router.push('/admin/happy-bites')} className="mx-4 mt-3 flex-row items-center rounded-xl border border-[#D9D0C8]/60 px-4 py-3 dark:border-[#4A4542]">
            <Ionicons name="sparkles-outline" size={20} color="#F25F45" />
            <View className="ml-3 flex-1"><Text className="font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">Content Management → Happy Bites</Text><Text className="mt-0.5 text-xs text-[#6B625C] dark:text-[#A8A29E]">Manage short free audio</Text></View>
            <Ionicons name="chevron-forward" size={19} color="#A8A29E" />
          </Pressable>
          {books.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
                No books yet. Tap Add book to create one.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerClassName="px-4 pb-28 pt-4 gap-y-2"
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={() => void loadAll()}
                  tintColor="#F25F45"
                  colors={['#F25F45']}
                />
              }
            >
              {books.map((book) => {
                const cover = String(book.coverImageUrl ?? '');
                const premium =
                  String(book.accessType ?? book.type ?? '') === 'premium';
                const episodes = Array.isArray(book.lessons)
                  ? book.lessons.length
                  : 0;
                return (
                  <View
                    key={String(book._id)}
                    className="flex-row items-center rounded-[14px] border border-[#D9D0C8]/50 p-2.5 dark:border-[#4A4542]"
                  >
                    {cover ? (
                      <Image
                        source={{ uri: cover }}
                        contentFit="cover"
                        style={{ width: 54, height: 72, borderRadius: 8 }}
                      />
                    ) : (
                      <View className="h-[72px] w-[54px] items-center justify-center rounded-lg bg-black/10">
                        <Ionicons name="book" size={22} color="#A8A29E" />
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <Text
                        numberOfLines={2}
                        className="text-[15px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]"
                      >
                        {String(book.title ?? 'Untitled')}
                      </Text>
                      <Text
                        numberOfLines={2}
                        className="mt-0.5 text-[12px] text-[#6B625C] dark:text-[#A8A29E]"
                      >
                        {String(book.language)}  •  {String(book.status)}  •{' '}
                        {premium ? 'Premium subscription' : 'Free'}  •{' '}
                        {episodes} episodes
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Book actions"
                      hitSlop={8}
                      onPress={() => openMenu(book)}
                      className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={20}
                        color="#A8A29E"
                      />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
            </View>
            <View
              className="flex-1"
              style={{ display: tab === 2 ? 'flex' : 'none' }}
            >
          <ScrollView contentContainerClassName="pb-8 pt-2">
            {users.map((entry, index) => {
              const contact = String(
                entry.phoneNumber ?? entry.email ?? 'No contact',
              );
              const name = String(entry.name ?? 'HappiNotes listener');
              return (
                <View key={String(entry._id ?? entry.id ?? index)}>
                  <View className="flex-row items-center px-4 py-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#E8E2DE] dark:bg-[#2C2C2C]">
                      <Text className="font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
                        {(name || contact).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
                        {name}
                      </Text>
                      <Text className="text-[13px] text-[#6B625C] dark:text-[#A8A29E]">
                        {contact}
                      </Text>
                    </View>
                    {entry.role === 'admin' ? (
                      <View className="rounded-full bg-[#E8E2DE] px-2.5 py-1 dark:bg-[#2C2C2C]">
                        <Text className="text-[12px] text-[#241F1C] dark:text-[#F8F5F0]">
                          admin
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="h-px bg-[#D9D0C8]/50 dark:bg-[#4A4542]/60" />
                </View>
              );
            })}
          </ScrollView>
            </View>
            <View
              className="flex-1"
              style={{ display: tab === 3 ? 'flex' : 'none' }}
            >
          <ScrollView contentContainerClassName="px-5 pb-8 pt-5">
            <Text className="text-[24px] font-black text-[#241F1C] dark:text-[#F8F5F0]">
              Send notification
            </Text>
            <Text className="mt-2 text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
              Broadcast an update to listener devices.
            </Text>
            <View className="mt-5" />
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Field
              label="Message"
              value={message}
              onChangeText={setMessage}
              multiline
            />
            {notificationImageUrl ? (
              <Image
                source={{ uri: notificationImageUrl }}
                contentFit="cover"
                style={{
                  width: '100%',
                  height: 150,
                  borderRadius: 14,
                  marginBottom: 8,
                }}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void uploadNotificationImage()}
              className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-[15px] border border-[#D9D0C8] px-4 active:opacity-70 dark:border-[#4A4542]"
            >
              <Ionicons name="image-outline" size={20} color="#F25F45" />
              <Text className="font-extrabold text-coral">
                {notificationImageUrl
                  ? 'Replace notification image'
                  : 'Add notification image'}
              </Text>
            </Pressable>
            <View className="mt-3.5">
              <ChoiceField
                label="Audience"
                value={target}
                options={['all', 'free', 'premium']}
                onChange={setTarget}
              />
            </View>
            <ActionButton
              label={busy ? 'Sending...' : 'Send notification'}
              icon="send"
              onPress={() => void sendNotification()}
              disabled={busy}
            />
          </ScrollView>
            </View>
          </>
        )}
      </View>

      {tab === 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            newBook();
            router.push('/admin/book-editor');
          }}
          className="absolute bottom-[84px] right-5 flex-row items-center gap-2 rounded-2xl bg-coral px-4 py-3.5 shadow-lg active:opacity-80"
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text className="font-extrabold text-white">Add book</Text>
        </Pressable>
      ) : null}

      <View className="flex-row border-t border-[#D9D0C8]/50 bg-white px-1 pb-1.5 pt-1 dark:border-[#4A4542]/60 dark:bg-[#1B1B1B]">
        {TABS.map((entry, index) => {
          const active = tab === index;
          return (
            <Pressable
              key={entry.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(index)}
              className="flex-1 items-center py-1.5"
            >
              <View
                className={`h-8 w-16 items-center justify-center rounded-2xl ${
                  active ? 'bg-coral/15' : ''
                }`}
              >
                <Ionicons
                  name={active ? entry.active : entry.icon}
                  size={23}
                  color={active ? '#F25F45' : '#A8A29E'}
                />
              </View>
              <Text
                className={`mt-0.5 text-xs font-bold ${
                  active
                    ? 'text-[#241F1C] dark:text-[#F8F5F0]'
                    : 'text-[#6B625C] dark:text-[#A8A29E]'
                }`}
              >
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
