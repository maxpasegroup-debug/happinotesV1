# HappiNotes React Native

Expo Router app migrated from the Flutter HappiNotes client. The app uses React Native with NativeWind, the existing Railway API, native audio playback, store subscriptions, push notifications, and the admin content tools.

## Setup

```bash
npm install
npx expo start
```

The backend origin is read from `.env` as `EXPO_PUBLIC_API_BASE_URL`. `.env.example` contains the expected setting. Keep the value as an API origin without a path or trailing slash.

This app uses native modules for in-app purchases, background audio, secure token storage, document picking, and notifications. Use an Expo development build for the full app; Expo Go does not include all of these native modules.

```bash
npx expo run:android
npx expo run:ios
```

Android Firebase configuration is in `google-services.json` and matches the Android application ID in `app.json`. iOS push delivery needs the app’s Apple Firebase/APNs configuration and credentials.

## Checks

```bash
npx tsc --noEmit
npx expo export --platform android
npx expo export --platform ios
npx expo export --platform web
```

Store subscriptions also require the matching monthly product to be configured in Google Play or App Store Connect and returned by the backend subscription-plan endpoint.
