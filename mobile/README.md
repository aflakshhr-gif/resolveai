# ResolveAI — One cross-platform mobile app

ResolveAI is **one mobile application built from one shared React Native / Expo codebase** for Android phones, iPhones, and iPads. Android and iOS are build targets of this same app, not separate products.

## Run the app

```bash
cd mobile
npm install
npx expo start
```

Install Expo Go on a test phone and scan the development QR code, or run `npx expo start --android` / `npx expo start --ios`.

## Build both platforms from the same project

Install and configure EAS Build:

```bash
npm install -g eas-cli
eas login
eas build:configure
```

Android installable test build (APK):

```bash
eas build --platform android --profile preview
```

Android store build (AAB):

```bash
eas build --platform android --profile production
```

iPhone / iOS build (IPA):

```bash
eas build --platform ios --profile production
```

## Store release

- Google Play publication requires a Google Play Console developer account and store listing assets.
- iOS distribution / App Store publication requires an Apple Developer account, app identifiers, signing, privacy details, and App Store Connect setup.
- These builds have not yet been generated or submitted to either store.

## Current implementation status

The app currently contains the ResolveAI support inbox UI with sample local conversations. It is a prototype: authentication, live shared backend/database, push notifications, and real AI responses still need implementation and production credentials. Do not treat sample data or demo replies as live customer support.
