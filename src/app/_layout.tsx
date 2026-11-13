import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MotionProvider, useAppMotion } from '@/providers/motion';
import { AppLanguageProvider } from '@/providers/app-language';
import '../global.css';
import { ThemeProvider, useAppTheme } from '@/providers/theme';
import { ToastProvider } from '@/providers/toast';
import { AuthProvider, useAuth } from '@/providers/auth';
import { BooksProvider } from '@/providers/books';
import { NotificationsProvider } from '@/providers/notifications';
import { SubscriptionProvider } from '@/providers/subscription';
import { AdminProvider } from '@/providers/admin';
import { PlayerProvider } from '@/providers/player';
import { HappyBitesProvider } from '@/providers/happy-bites';
import { RuntimeBridge } from '@/components/runtime-bridge';

function RootNavigator() {
  const { dark } = useAppTheme();
  const { initialized, user } = useAuth();
  const { animationsEnabled } = useAppMotion();
  const backgroundColor = dark ? '#111111' : '#FFFFFF';
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: { ...baseTheme.colors, background: backgroundColor, card: backgroundColor },
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
    <View className={`flex-1 ${dark ? 'dark' : ''}`} style={{ backgroundColor }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: !animationsEnabled ? 'none' : Platform.OS === 'ios' ? 'simple_push' : 'slide_from_right',
          animationDuration: animationsEnabled ? 260 : 0,
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="forgot-password" />
        <Stack.Protected guard={initialized && user !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" />
          <Stack.Screen name="book/[id]" />
          <Stack.Screen name="player" options={{ animation: !animationsEnabled ? 'none' : 'slide_from_bottom' }} />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen
            name="notifications"
            options={{
              presentation: 'transparentModal',
              animation: !animationsEnabled ? 'none' : 'slide_from_bottom',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/book-editor" />
          <Stack.Screen name="admin/happy-bites" />
        </Stack.Protected>
        <Stack.Screen name="legal" />
      </Stack>
      <RuntimeBridge />
    </View>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppLanguageProvider>
    <MotionProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BooksProvider>
              <NotificationsProvider>
                <SubscriptionProvider>
                  <AdminProvider>
                    <HappyBitesProvider>
                      <PlayerProvider>
                        <RootNavigator />
                      </PlayerProvider>
                    </HappyBitesProvider>
                  </AdminProvider>
                </SubscriptionProvider>
              </NotificationsProvider>
            </BooksProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionProvider>
    </AppLanguageProvider>
    </GestureHandlerRootView>
  );
}
