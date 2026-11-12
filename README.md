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

## Audio playback during development

Expo Go supports foreground listening here. The app skips native background playback
and lock-screen controls in Expo Go because it cannot apply this project's audio
plugin configuration. This applies to both Happy Bites and audiobooks.

`app.json` already enables `expo-audio`'s `enableBackgroundPlayback`. An installed
build must include that configuration: restarting Metro or updating JavaScript
cannot add Android's playback service to an older APK. Build and install a fresh
preview APK to test background playback and lock-screen controls:

```bash
npx eas-cli build --platform android --profile preview
```

After installing the new APK, verify Happy Bite and audiobook play/pause, lock the
screen, and check the media controls. On Android the generated manifest must contain
`expo.modules.audio.service.AudioControlsService` with the `mediaPlayback` foreground
service type and the `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
permissions. The Expo audio config plugin supplies these; do not manually edit
generated native files. See the [Expo audio configuration docs](https://docs.expo.dev/versions/v58.0.0/sdk/audio/#playing-audio-in-the-background).

## Checks

```bash
npx tsc --noEmit
npx expo export --platform android
npx expo export --platform ios
npx expo export --platform web
```

Store subscriptions also require the matching monthly product to be configured in Google Play or App Store Connect and returned by the backend subscription-plan endpoint.
