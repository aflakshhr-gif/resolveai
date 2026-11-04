# ResolveAI password-reset email setup

The password-reset flow sends a one-time link. The Worker stores only a SHA-256 digest of the token; it never sends or stores the user's new password in email.

## Recommended provider: Cloudflare Email Service

This branch declares an `EMAIL` binding in the **Preview** configuration only. Production does not receive the binding from this change.

1. In Cloudflare, open **Compute → Email Service → Email Sending**.
2. Choose **Onboard Domain** and select a domain in your Cloudflare account that uses Cloudflare DNS.
3. Publish/accept the SPF, DKIM, and DMARC records Cloudflare provides, then wait for the domain to be verified.
4. Add your own Gmail address as a verified destination address if the account is on Workers Free. Free plans can send to verified destination addresses; arbitrary recipients require Workers Paid.
5. Choose a sender address on the verified domain, for example `no-reply@your-domain.example`.
6. Set the Preview variable `RESOLVEAI_FROM_EMAIL` to that sender address. Keep `RESOLVEAI_PUBLIC_URL` as configured in `wrangler.jsonc`.

Do not add the sender address or Email binding to Production until Preview password recovery has been tested.

## Optional provider: Resend

The Worker also supports Resend as a fallback when the Cloudflare `EMAIL` binding is unavailable. To use it instead:

- Set `RESEND_API_KEY` as a Cloudflare Secret on the Preview only.
- Set `RESOLVEAI_FROM_EMAIL` to a sender on a domain verified with Resend.
- Keep `RESOLVEAI_PUBLIC_URL` set to the stable Preview origin.

Never commit an API key to Git, paste it into a GitHub issue, or send it in chat.

## Preview test procedure

1. Open the stable Preview URL and choose **Forgot password?**
2. Enter the email address of an existing Preview account.
3. Check the inbox (and spam folder) for the reset message.
4. Follow the link within 30 minutes.
5. Set a new password of at least 12 characters and confirm it.
6. Sign in with the new password. All existing sessions for that account should have been revoked.
7. Confirm an expired or previously used link is rejected.

The request endpoint returns the same response whether or not an account exists, to avoid exposing registered addresses. Requests are rate-limited by hashed email and IP. Tokens are random, stored only as SHA-256 digests, expire after 30 minutes, and can be used once.

## Before Production

Configure the sending domain and sender separately for Production, and add the production email binding only after delivery, reset-link expiry, one-time use, and session revocation have been verified on Preview. Keep the Preview D1 binding pointed at `resolveai-preview-db`; do not connect it to the Production database.
