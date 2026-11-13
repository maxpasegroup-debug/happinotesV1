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

Android and iOS now use `com.happinotes.app` in `app.json`. **Before building Android**, register this Android package in Firebase and replace `google-services.json` with the downloaded configuration. The current file still belongs to the legacy Flutter package and cannot build the renamed app. Set deployed backend `GOOGLE_PLAY_PACKAGE_NAME` and `APPLE_BUNDLE_ID` to the new identifiers when configuring the new store listings; the backend example has been updated, but live environment variables have not.

iOS push delivery is not release-ready: the client currently sends an APNs token to the backend's FCM token endpoint. Provider integration and credentials must be aligned before claiming iOS push support.

## Store release

See [STORE_RELEASE.md](STORE_RELEASE.md) for the release configuration, identifier dependencies, outstanding blockers, and signed-build verification checklist. This repository has not yet been verified as ready for submission.

## Happy Bites realtime updates

The app listens for `happy-bites:changed` on the existing Socket.IO connection and reloads the current Happy Bites category through the public API. It also resyncs after reconnecting or returning to the foreground. The backend emits this signal only after a successful Happy Bite create, update (including publish/unpublish), or delete; it contains no content or audio URLs. Deploy the updated backend and app together to enable this behavior. Uploading a media file alone does not publish a Happy Bite; the existing save/publish workflow still applies.

## Saving Happy Bites

Happy Bite cards and the shared player can save/remove bites in My Library. The app uses the real Happy Bite ID with `POST` / `DELETE /collection/happy-bites/:biteId`; its `happy-bite-…` player ID is never sent to the audiobook endpoint. `GET /collection` returns existing audiobook `collection` data plus a separate `happyBites` list. Both are restored into the library; saved bites open through the player with a fresh availability/Pro check. Bookmarking does not unlock premium audio.

The backend stores these bookmarks in `User.happyBiteCollection`, independently of audiobook references, and excludes deleted/unpublished bites from reads. Save requests are idempotent and keep the existing account-write authorization. Account-deletion preference cleanup clears these bookmarks too. Deploy the updated backend before releasing this app change; older servers do not have the Happy Bite save routes. No data migration or new dependency is required for existing users.

## Interface languages and notification refresh

Profile → App language offers 29 choices: India's 22 scheduled languages, English, Spanish, French, German, Portuguese, Japanese, and Indonesian. Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu have interface dictionaries covering all 269 current translation keys. Bodo, Dogri, Kashmiri, Konkani, Maithili, Manipuri, Santali, and Sindhi are selectable with an explicit **English fallback** label, as approved, until reviewed translations are available. These choices persist normally.

The scrollable picker searches native names, English identifiers, and common aliases such as Meitei, Oriya, and Santhali. Urdu, Kashmiri, and Sindhi names use right-to-left text direction; this does not enable a mirrored app layout. Selection is saved on the device and remains separate from audiobook listening preferences. Publisher content, server error messages, and external policy pages retain their original language. The new dictionaries are drafts requiring native-speaker review, including account and subscription wording.

Pull down inside the Notifications list or tap its refresh button to reload the inbox. A bell follows the pull and rings while loading; disabling app animations or enabling system Reduce Motion uses a stationary indicator. Swipe down on the handle or header to dismiss the panel; pulling the notification list still refreshes it. Refresh failures preserve the existing list and offer a retry. This feature uses the installed gesture and animation libraries and adds no dependencies. Translation coverage and animation lifecycle are tested locally; device layout and native-speaker review remain separate checks.

The notification sheet and both app/listening-language pickers share native `useSheetDismiss` gestures with Reanimated movement: a short downward drag springs back, while a longer or quick downward swipe closes the sheet. Language pickers also accept a downward pull on the list when it is already at the top; scrolling elsewhere in the list does not dismiss it. The language modal has its own gesture root and a simultaneous native scroll relationship. Its handle, arrow, and close button use neutral colors; gold remains on the profile avatar. Outside taps, Android back, and accessibility dismissal remain available; language selection continues to work independently. A picker without a close callback remains non-dismissible. Disabling animations or system Reduce Motion removes the settling/closing animation. Native gesture interaction still needs a device check.

The profile initial avatar has a 3 px gold gradient ring using `#FB8500`, `#FFB703`, `#EE9B00`, and `#FCA311`, with a separated inner circle and text colors for light and dark themes.

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
