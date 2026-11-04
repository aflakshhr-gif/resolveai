# ResolveAI Mobile

Expo / React Native client for Android and iOS, connected to the same private ResolveAI workspace API as the web app.

## Included

- Private sign-in using Expo SecureStore.
- Shared inbox, create conversations, change status and save internal replies.
- Rule-based support analysis, not a real language model.
- Replies are internal only and are not delivered to customers.

## Run locally

```bash
cd mobile
npm install
npx expo start
```

Sign in with an existing ResolveAI team account. The client uses the production Worker API configured in `App.tsx`.

## Native release status

The repository's GitHub Actions workflow runs `npx expo export --platform android` and `npx expo export --platform ios` to validate the app bundles. These are CI checks, **not signed native install packages** and not store releases.

A real Android/iOS release requires the app owner's private Expo/EAS account and platform credentials:

1. Install the EAS CLI and sign in to the owner's Expo account.
2. Run `eas build:configure` from this folder and keep the resulting EAS project ID in the app configuration.
3. Run `eas build --platform android --profile preview` for an Android APK test build.
4. Configure Android Play signing / Play Console for an Android App Bundle release.
5. Configure Apple Developer signing and App Store Connect before building/submitting the iOS app.

Do not publish the app under another person's Expo, Apple or Google Play account. Store publication and approvals are separate from the public web deployment.

## Production limitations

Replies remain internal notes; they are not sent to customers. Copilot is rule-based and does not call a language model. External chat integrations and push notifications are not enabled.
