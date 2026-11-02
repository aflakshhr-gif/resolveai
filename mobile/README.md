# ResolveAI Mobile

A cross-platform Android and iOS companion app built with Expo / React Native.

## Run locally

```bash
cd mobile
npm install
npx expo start
```

Scan the Expo Go QR code with Expo Go on a phone, or press `a` / `i` to launch an installed emulator.

## Build installable apps

Configure an Expo account and EAS Build, then:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
eas build --platform ios
```

Store publication requires the relevant Google Play Console / Apple Developer accounts and credentials.

## Current limitations

This is a functional UI prototype with local demo conversations. It does not yet connect to the website database, authentication, or a live AI/support API. Those require a shared backend and service credentials.
