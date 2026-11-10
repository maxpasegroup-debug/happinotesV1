import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, API_SOCKET_PATH, request } from '@/lib/api';
import { PUSH_NOTIFICATIONS_SUPPORTED } from '@/lib/app-environment';
import { useAuth } from '@/providers/auth';
import { useAdmin } from '@/providers/admin';
import { useBooks } from '@/providers/books';
import { useNotifications } from '@/providers/notifications';
import { useSubscription } from '@/providers/subscription';

// Flutter only refreshes the notification list when a push arrives while the
// app is in the foreground; it never shows an in-app banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

function RealtimeBridge() {
  const { user } = useAuth();
  const { reloadActive } = useBooks();
  const { loadAll } = useAdmin();
  const { reload } = useSubscription();
  const callbacks = useRef({ reloadActive, loadAll, reload, role: user?.role });

  useEffect(() => {
    callbacks.current = { reloadActive, loadAll, reload, role: user?.role };
  });

  useEffect(() => {
    if (!user) return;
    let catalogTimer: ReturnType<typeof setTimeout> | undefined;
    let planTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshCatalog = () => {
      if (catalogTimer) clearTimeout(catalogTimer);
      catalogTimer = setTimeout(() => {
        void callbacks.current.reloadActive();
        if (callbacks.current.role === 'admin') {
          void callbacks.current.loadAll();
        }
      }, 300);
    };
    const refreshPlans = () => {
      if (planTimer) clearTimeout(planTimer);
      planTimer = setTimeout(() => {
        void callbacks.current.reload();
      }, 300);
    };

    const socket: Socket = io(API_ORIGIN || undefined, {
      path: API_SOCKET_PATH,
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: true,
    });
    socket.on('connect', refreshCatalog);
    socket.on('books:changed', refreshCatalog);
    socket.on('subscription-plans:changed', refreshPlans);

    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!socket.connected) socket.connect();
      refreshCatalog();
      refreshPlans();
    });

    return () => {
      if (catalogTimer) clearTimeout(catalogTimer);
      if (planTimer) clearTimeout(planTimer);
      appState.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [user]);

  return null;
}

function PushBridge() {
  const { user } = useAuth();
  const { load } = useNotifications();
  const { resolveBook } = useBooks();
  const resolveRef = useRef(resolveBook);

  useEffect(() => {
    resolveRef.current = resolveBook;
  });

  useEffect(() => {
    if (!user) return;
    // expo-notifications only warns and no-ops on web, so never mount the
    // push bridge in the browser.
    if (Platform.OS === 'web') return;
    let active = true;

    const registerToken = async (token: string) => {
      if (!token) return;
      try {
        await request('/auth/me/fcm-token', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
      } catch {
        // The next token refresh or app launch will retry registration.
      }
    };

    // Flutter only opens the detail page when the referenced book exists.
    const openBook = async (data: Record<string, unknown> | undefined) => {
      const bookId = String(data?.bookId ?? '');
      if (!bookId) return;
      const book = await resolveRef.current(bookId);
      if (!active || !book) return;
      router.push({ pathname: '/book/[id]', params: { id: bookId } });
    };

    // Any of these calls can throw (Expo Go, missing permissions, older
    // runtimes). An exception escaping an effect unmounts the whole app, so
    // notifications must stay strictly best-effort here — exactly like
    // Flutter's FcmService, which wraps initialisation in a try/catch.
    const subscriptions: { remove: () => void }[] = [];
    try {
      subscriptions.push(
        Notifications.addNotificationResponseReceivedListener((response) => {
          void openBook(
            response.notification.request.content.data as Record<string, unknown>,
          );
        }),
      );

      subscriptions.push(
        Notifications.addNotificationReceivedListener(() => {
          void load(true);
        }),
      );

      // Expo Go refuses push-token APIs (it throws) and the web build has no
      // remote notifications; both must skip registration entirely.
      if (PUSH_NOTIFICATIONS_SUPPORTED) {
        subscriptions.push(
          Notifications.addPushTokenListener((token) => {
            const value = String(token.data ?? '');
            if (value) void registerToken(value);
          }),
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[push] notification listeners unavailable', error);
      }
    }

    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'HappiNotes',
            importance: AndroidImportance.DEFAULT,
          });
        }
        if (!PUSH_NOTIFICATIONS_SUPPORTED) return;
        const permission = await Notifications.requestPermissionsAsync();
        if (!active) return;
        if (permission.granted) {
          const token = await Notifications.getDevicePushTokenAsync();
          await registerToken(String(token.data));
        }
        const initial = await Notifications.getLastNotificationResponseAsync();
        if (active && initial) {
          await openBook(
            initial.notification.request.content.data as Record<string, unknown>,
          );
        }
      } catch {
        // Notifications must never prevent the app from opening or logging in.
      }
    })();

    return () => {
      active = false;
      for (const subscription of subscriptions) {
        try {
          subscription.remove();
        } catch {
          // Already torn down.
        }
      }
    };
  }, [load, user]);

  return null;
}

export function RuntimeBridge() {
  return (
    <>
      <RealtimeBridge />
      <PushBridge />
    </>
  );
}
