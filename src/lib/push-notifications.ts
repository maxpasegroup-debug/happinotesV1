import { requireOptionalNativeModule } from "expo";
import { PUSH_NOTIFICATIONS_SUPPORTED } from "./app-environment";

type Notifications = typeof import("expo-notifications");
let notificationsPromise: Promise<Notifications | null> | undefined;

/** Never evaluate expo-notifications until its native dependencies are present. */
export function loadPushNotifications(): Promise<Notifications | null> {
  if (!PUSH_NOTIFICATIONS_SUPPORTED) return Promise.resolve(null);
  notificationsPromise ??= (async () => {
    try {
      // A JS update cannot add native modules to an already installed app.
      for (const name of [
        "ExpoApplication",
        "ExpoNotificationsEmitter",
        "ExpoNotificationsHandlerModule",
        "ExpoPushTokenManager",
      ]) {
        if (!requireOptionalNativeModule(name)) {
          if (__DEV__) {
            console.warn(`[push] ${name} is missing. Rebuild and reinstall the app to enable push notifications.`);
          }
          return null;
        }
      }
      return await import("expo-notifications");
    } catch {
      if (__DEV__) {
        console.warn("[push] Notifications are unavailable in this app build. Rebuild and reinstall the app to enable them.");
      }
      return null;
    }
  })();
  return notificationsPromise;
}
