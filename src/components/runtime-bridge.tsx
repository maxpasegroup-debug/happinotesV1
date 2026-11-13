import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { router } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { API_ORIGIN, API_SOCKET_PATH, request } from "@/lib/api";
import { loadPushNotifications } from "@/lib/push-notifications";
import { useAuth } from "@/providers/auth";
import { useAdmin } from "@/providers/admin";
import { useBooks } from "@/providers/books";
import { useHappyBites } from "@/providers/happy-bites";
import { useNotifications } from "@/providers/notifications";
import { useSubscription } from "@/providers/subscription";

function RealtimeBridge() {
  const { user } = useAuth();
  const { reloadActive } = useBooks();
  const { reloadActive: reloadHappyBites } = useHappyBites();
  const { loadAll } = useAdmin();
  const { reload } = useSubscription();
  const callbacks = useRef({ reloadActive, reloadHappyBites, loadAll, reload, role: user?.role });

  useEffect(() => {
    callbacks.current = { reloadActive, reloadHappyBites, loadAll, reload, role: user?.role };
  });

  useEffect(() => {
    if (!user) return;
    let catalogTimer: ReturnType<typeof setTimeout> | undefined;
    let planTimer: ReturnType<typeof setTimeout> | undefined;
    let happyBitesTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshCatalog = () => {
      if (catalogTimer) clearTimeout(catalogTimer);
      catalogTimer = setTimeout(() => {
        void callbacks.current.reloadActive();
        if (callbacks.current.role === "admin") {
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
    const refreshHappyBites = () => {
      if (happyBitesTimer) clearTimeout(happyBitesTimer);
      happyBitesTimer = setTimeout(() => {
        void callbacks.current.reloadHappyBites();
      }, 300);
    };

    const socket: Socket = io(API_ORIGIN || undefined, {
      path: API_SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnection: true,
      autoConnect: true,
    });
    socket.on("connect", refreshCatalog);
    socket.on("connect", refreshHappyBites);
    socket.on("books:changed", refreshCatalog);
    socket.on("happy-bites:changed", refreshHappyBites);
    socket.on("subscription-plans:changed", refreshPlans);

    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!socket.connected) socket.connect();
      refreshCatalog();
      refreshHappyBites();
      refreshPlans();
    });

    return () => {
      if (catalogTimer) clearTimeout(catalogTimer);
      if (planTimer) clearTimeout(planTimer);
      if (happyBitesTimer) clearTimeout(happyBitesTimer);
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
    if (Platform.OS === "web") return;
    let active = true;

    const registerToken = async (token: string) => {
      if (!active || !token) return;
      try {
        await request("/auth/me/fcm-token", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      } catch {}
    };
    const openBook = async (data: Record<string, unknown> | undefined) => {
      const bookId = String(data?.bookId ?? "");
      if (!bookId) return;
      const book = await resolveRef.current(bookId);
      if (!active || !book) return;
      router.push({ pathname: "/book/[id]", params: { id: bookId } });
    };
    const subscriptions: { remove: () => void }[] = [];
    let notifications: Awaited<ReturnType<typeof loadPushNotifications>> = null;
    void (async () => {
      const Notifications = await loadPushNotifications();
      if (!active || !Notifications) return;
      notifications = Notifications;
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          }),
        });
        subscriptions.push(
          Notifications.addNotificationResponseReceivedListener((response) => {
            void openBook(
              response.notification.request.content.data as Record<
                string,
                unknown
              >,
            );
          }),
        );

        subscriptions.push(
          Notifications.addNotificationReceivedListener(() => {
            void load(true);
          }),
        );
        subscriptions.push(
          Notifications.addPushTokenListener((token) => {
            const value = String(token.data ?? "");
            if (value) void registerToken(value);
          }),
        );
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "HappiNotes",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        if (!active) return;
        const permission = await Notifications.requestPermissionsAsync();
        if (!active) return;
        if (permission.granted) {
          const token = await Notifications.getDevicePushTokenAsync();
          await registerToken(String(token.data));
        }
        if (!active) return;
        const initial = await Notifications.getLastNotificationResponseAsync();
        if (active && initial) {
          await openBook(
            initial.notification.request.content.data as Record<
              string,
              unknown
            >,
          );
        }
      } catch {}
    })();
    return () => {
      active = false;
      for (const subscription of subscriptions) {
        try {
          subscription.remove();
        } catch {}
      }
      notifications?.setNotificationHandler(null);
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
