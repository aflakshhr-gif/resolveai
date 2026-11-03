# ResolveAI Mobile
Expo / React Native app for Android and iOS, connected to the private ResolveAI workspace.
- Private sign-in using Expo SecureStore.
- Shared inbox, create conversations, change status and save internal replies.
- Rule-based support analysis, not a real language model.
Replies are internal only and are not sent to customers.
## Run
`npm install` then `npx expo start`. Sign in with your existing ResolveAI team account.
## Native builds
Requires a private Expo/EAS account and platform signing credentials:
`npm install -g eas-cli`, `eas login`, `eas build --platform android --profile preview`, `eas build --platform ios --profile production`.
Android preview creates an APK. iOS distribution needs Apple signing. Store submissions are not automated by web deployment.
