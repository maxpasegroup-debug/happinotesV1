import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/**
 * Expo Go is detected the same way `expo-notifications` detects it internally.
 * Note that `Constants.expoConfig.hostUri` cannot be used for this: it is also
 * present in development builds, which are exactly the builds where the
 * features below do work.
 */
export const IS_EXPO_GO = isRunningInExpoGo();

/**
 * `expo-notifications` throws on its push APIs inside Expo Go since SDK 53
 * (FCM registration only exists in a development build), and the web build has
 * no remote notifications at all.
 */
export const PUSH_NOTIFICATIONS_SUPPORTED =
  Platform.OS !== "web" && !IS_EXPO_GO;

/** react-native-web has no native animated driver; asking for one warns. */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";
