# ResolveAI

ResolveAI is a private customer-support workspace with a public product website, responsive web app, installable PWA, public account requests, administrator-reviewed membership, QR access and an Expo mobile client.

## Production addresses

- Public website (homepage): https://resolveai.aflakshhr.workers.dev/
- Public product page: https://resolveai.aflakshhr.workers.dev/website/
- Private team sign-in and public account request: https://resolveai.aflakshhr.workers.dev/login/
- QR access page: https://resolveai.aflakshhr.workers.dev/qr/

The root URL serves the public website to visitors and the authenticated workspace to approved team members. Private workspace data is stored in the dedicated `resolveai-db` D1 database. Account requests are reviewed by the registered block administrator; approval assigns the user to a separate unit workspace.

## Web app

The web app is a static Next.js export served by the Cloudflare Worker. It includes a web app manifest, service-worker registration, responsive layouts and browser-based installation instructions. On Android/Chrome, use the browser's Install app option; on iPhone, use Share → Add to Home Screen.

## Mobile app

The Expo/React Native client is in `mobile/` and connects to the same production Worker API. It uses Expo SecureStore for the mobile session. GitHub Actions validates Android and iOS JavaScript exports; those checks do **not** create signed APK/AAB/IPA files. Native builds and Play Store / App Store submissions require the owner's Expo/EAS account and platform signing/developer credentials. See `mobile/README.md`.

## Current product boundaries

- Customer conversation replies are saved internally; they are not sent to customers.
- Copilot suggestions are rule-based demo logic, not a language model.
- External chat-channel integrations and push notifications are not enabled.
- Transactional account verification and password-reset flows use the separately configured Google Apps Script mailer; verify delivery end-to-end before relying on it operationally.

Initial owner setup uses the `RESOLVEAI_SETUP_TOKEN` Cloudflare Worker secret. Never commit API keys, setup tokens or the Google Apps Script shared secret. Never use Block 17's Worker or database.
