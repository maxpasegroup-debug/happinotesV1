# HappiNotes store release

Audit date: 2026-11-13. This is an Expo SDK 58 / React Native app. A package or bundle identifier containing “flutter” does not determine its framework or violate store rules by itself.

Status: configuration prepared; **not ready to submit**. No signed AAB/IPA or store upload has been produced or tested in this audit.

## Identifiers — updated, external registration required before building

Current Android application ID: `com.happinotes.app`.
Current iOS bundle ID: `com.happinotes.app`.

The requested rename is applied in `app.json` and the backend `.env.example`. **The checked-in `google-services.json` still belongs to `com.happinotes.happinotes_flutter`; replace it with Firebase's actual download for the new Android registration before building.** Live backend/store/Firebase settings have not been changed. The old iOS ID was `com.happinotes.happinotesFlutter`. These new IDs cannot update listings that already received builds under the old IDs; confirm store history before registering/submitting the renamed app.

Coordinate all of these before the first build:

- Register the configured `android.package` / `ios.bundleIdentifier` in the corresponding stores.
- Register the new Android app in the existing Firebase project and download its actual `google-services.json`. Do not simply replace package strings inside the old file. Register signing certificate fingerprints as required by enabled Firebase services.
- Set backend `GOOGLE_PLAY_PACKAGE_NAME` and `APPLE_BUNDLE_ID` to the actual store identifiers. Review their example values too. Do not switch a live backend away from an existing app without planning continued purchase verification for its users.
- Configure the matching Play Console and App Store Connect apps, product IDs, subscription plans, purchase verification credentials, and store notification endpoints. Existing purchases do not automatically migrate to a new app identity.
- Link the correct Expo/EAS project and configure Android signing and Apple signing/APNs credentials. Do not create placeholder project IDs or credentials.

The Android subscription-management link now reads the configured package instead of hard-coding the legacy ID.

## Configuration prepared

- EAS production builds explicitly use store distribution, an Android App Bundle, and an iOS device Release build.
- The existing local version source and automatic build-number increments remain enabled. Compare Android versionCode and iOS buildNumber with the highest uploaded values before building; local increments cannot discover builds made elsewhere.
- Android submission defaults to an internal-track draft, not a public rollout. First-upload/setup steps may still need the Play Console.
- Production API traffic uses the existing HTTPS Railway origin. iOS arbitrary external HTTP loads are disabled; local networking remains available for development. All production media URLs must also use HTTPS.
- Unused microphone, legacy shared-storage, overlay, and Face ID permissions are removed. Background audio remains enabled. Silent-background push mode is disabled because this client has no registered background notification task; ordinary notifications are unchanged.
- The subscription screen includes direct privacy and terms links, with an error message if opening a link fails.

Native configuration changes require a fresh installed build; Metro reloads and JavaScript updates do not apply them.

## Outstanding launch blockers

1. **Policies:** the in-app legal screen explicitly marks the policies as drafts. Finalize and publish the actual privacy policy, terms, and deletion policy. Verify the public `/privacy-policy`, `/terms`, and `/account-deletion` URLs at `https://happinotes.online` from a signed-out browser. Their availability has not been verified here. Remove draft messaging only after the policies are approved and deployed.
2. **Account deletion:** backend `src/services/accountDeletion.ts` can return `blocked_policy` while retention policy approval is missing. Approve and implement the retention requirements, then verify an actual request completes and removes the promised data. Do not bypass this gate without defining lawful retention and deletion behavior. Verify the public web deletion request path as well as the in-app flow.
3. **iOS push:** `RuntimeBridge` obtains a native APNs token on iOS, while the backend token endpoint and sender use FCM. Choose and implement a matching provider path (APNs, Expo Push, or actual Firebase Messaging registration on iOS), configure its credentials, and test on a device. APNs credentials alone do not convert an APNs token into an FCM token.
4. **Store setup:** confirm identifiers, signing, ownership, EAS project linkage, listings, reviewer access, subscription products and backend production configuration. No store account configuration was verified in this audit.
5. **Real builds:** perform the signed-build checks below. Passing TypeScript or a JavaScript export does not prove native library compatibility, purchase behavior, or acceptance by either store.

## Build and validate

After the blockers and identity decision are resolved, run from this directory:

```bash
npm ci
npm run lint
npx tsc --noEmit
node --test test/*.test.cjs
npx expo-doctor
npx expo install --check
npx expo export --platform all
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Link the intended existing EAS project where one exists. Review any build-number changes before another build. Builds/signing and store submission are separate operations; these commands have not been run against cloud accounts by this audit.

Before submission, verify:

- The final AAB targets Android 16/API 36 or later, includes required 64-bit architectures, and every native dependency supports 16 KB page sizes. Inspect the actual bundle and run Play's pre-launch report. Installed Expo defaults are not a substitute for inspecting the artifact.
- The iOS archive uses Xcode 26 or newer and iOS 26 SDK or newer, with a supported deployment target. Validate it in App Store Connect. Check SDK privacy manifests and required-reason API declarations against actual SDK behavior; do not invent declarations.
- Play internal testing and TestFlight: install, launch, login/OTP, logout, account deletion, content discovery, free/premium Happy Bites, audiobook access, downloads, interrupted/offline playback, background audio and lock-screen controls.
- Sandbox purchases: monthly/yearly and individual products actually offered by the app, restore, renewal, expiration, cancellation, pending transactions, refund/revocation handling, backend verification, and store notifications. Check localized prices and subscription disclosures.
- Notification permission denied/granted, push delivery for each supported platform, deep links, accessibility/text scaling, theme and reduced-motion settings, and screen layouts on supported devices.
- Store metadata: real screenshots, app description, age/content rating, support contact, reviewer instructions and working test credentials, privacy URL, Google Data safety and Apple App Privacy answers matching app/backend/third-party collection. Complete account-specific testing and production-access requirements in Play Console.
- Confirm that `ITSAppUsesNonExemptEncryption: false` accurately reflects the shipped app and SDKs; complete any required export-compliance declarations in App Store Connect.

After validating the signed builds and completing store setup, submission is a separate owner-controlled step:

```bash
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

## Official requirements reviewed

- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878): new apps and updates require API 36 or higher from August 31, 2026.
- [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/): Xcode 26 and iOS 26 SDK or newer for uploads; review the current age-rating and deployment-target requirements too.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): purchases, subscriptions, privacy, account deletion and review readiness.
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111): in-app and web deletion pathways.
- [Expo SDK 58 audio configuration](https://docs.expo.dev/versions/v58.0.0/sdk/audio/) and [EAS configuration](https://docs.expo.dev/eas/json/).

Recheck these policies when submitting; repository configuration cannot guarantee store approval.
