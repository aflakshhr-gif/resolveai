# ResolveAI password-reset email setup

The password-reset flow sends a one-time link through the Resend Email API. It does not send passwords, reset tokens, or API credentials to the browser.

## Required Worker configuration

Configure these values on the **Preview** service first. Do not add them to Production until Preview testing is complete.

| Name | Cloudflare setting | Example |
|---|---|---|
| `RESEND_API_KEY` | Secret | Resend API key beginning with `re_` |
| `RESOLVEAI_FROM_EMAIL` | Variable | `ResolveAI <no-reply@mail.your-domain.example>` |
| `RESOLVEAI_PUBLIC_URL` | Variable | `https://feature-unit-membership-approval-resolveai.aflakshhr.workers.dev` |

The sender address must belong to a domain verified in Resend. A Gmail address is not a substitute for a sending domain unless that domain is verified and authorized by Resend. Add the domain to Resend and publish the DNS records Resend supplies before testing delivery.

Keep `RESEND_API_KEY` as a Cloudflare Secret. Never commit it to this repository or paste it into GitHub issues, source code, or chat.

## Preview test procedure

1. Add the three settings to the Preview Worker configuration only.
2. Open the stable Preview URL and choose **Forgot password?**
3. Enter the email address of an existing Preview account.
4. Open the message delivered by Resend and follow the link within 30 minutes.
5. Set a new password (at least 12 characters) and confirm it.
6. Sign in with the new password. Any previous sessions for that account should have been revoked.
7. Confirm an expired or previously used reset link is rejected.

The request endpoint intentionally returns the same success message whether or not an account exists, to avoid exposing registered email addresses. Requests are rate-limited by hashed email and IP. The reset token is random, only its SHA-256 digest is stored, it expires after 30 minutes, and it can be consumed once.

## Before Production

Repeat the configuration separately for Production using the real public application URL and a verified sender domain. Do not point Preview at the Production database, and do not enable production password-reset sending until the domain, delivery, and account-recovery process have been verified.
