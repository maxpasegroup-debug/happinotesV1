import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import '../global.css';
import { ThemeProvider, useAppTheme } from '@/providers/theme';
import { ToastProvider } from '@/providers/toast';
import { AuthProvider } from '@/providers/auth';
import { BooksProvider } from '@/providers/books';
import { NotificationsProvider } from '@/providers/notifications';
import { SubscriptionProvider } from '@/providers/subscription';
import { AdminProvider } from '@/providers/admin';
import { PlayerProvider } from '@/providers/player';
import { RuntimeBridge } from '@/components/runtime-bridge';

function RootNavigator() {
  const { dark } = useAppTheme();
  return (
    <View className={`flex-1 ${dark ? 'dark' : ''}`}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#111111' : '#FFFFFF' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="player" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="delete-account" />
        <Stack.Screen
          name="notifications"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/book-editor" />
      </Stack>
      <RuntimeBridge />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BooksProvider>
            <NotificationsProvider>
              <SubscriptionProvider>
                <AdminProvider>
                  <PlayerProvider>
                    <RootNavigator />
                  </PlayerProvider>
                </AdminProvider>
              </SubscriptionProvider>
            </NotificationsProvider>
          </BooksProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
