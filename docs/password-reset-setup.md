# ResolveAI email delivery and verification (free Gmail bridge)

ResolveAI uses a one-time email link for new public registrations and password recovery. The Google Apps Script bridge sends both message types through the Gmail account that owns the script. No custom domain or paid email provider is required.

New public accounts cannot sign in or submit a membership application until their email address is verified. Existing legacy accounts are not forced through a new verification step. Password-reset links expire after 30 minutes; signup-verification links expire after 24 hours. Both are single-use and only token hashes are stored in D1.

## 1. Create the Gmail mailer

1. Sign in to the Google account that should send ResolveAI messages.
2. Open https://script.google.com and create a new standalone project named `ResolveAI Mailer`.
3. Replace the contents of `Code.gs` with the repository file [apps-script/Code.gs](../apps-script/Code.gs).
4. In **Project Settings → Script properties**, add:
   - `RESOLVEAI_SHARED_SECRET`: a randomly generated secret with at least 40 characters. Use a password manager to generate it. Do not reuse a Google password.
   - `RESOLVEAI_ALLOWED_ORIGINS`: `https://resolveai.aflakshhr.workers.dev,https://feature-unit-membership-approval-resolveai.aflakshhr.workers.dev`
5. Save the project.
6. Select **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click Deploy and approve Google's permission request to send email.
8. Copy the Web app URL ending in `/exec`. Do not use the editor URL.

The endpoint is publicly reachable because Cloudflare must call it without a Google login. It rejects requests without the long random shared secret, supports only the two fixed message types, validates recipients and exact ResolveAI origins, and never logs the request body or one-time tokens. Keep the script project private; do not add untrusted editors.

## 2. Configure Cloudflare Production

Open **Workers & Pages → resolveai → Settings → Variables and Secrets** and add:

| Name | Type | Value |
|---|---|---|
| `GOOGLE_APPS_SCRIPT_URL` | Variable | The Apps Script Web app URL ending in `/exec` |
| `GOOGLE_APPS_SCRIPT_TOKEN` | Secret | The exact same random value used for `RESOLVEAI_SHARED_SECRET` |
| `RESOLVEAI_PUBLIC_URL` | Variable | `https://resolveai.aflakshhr.workers.dev` |

Save and deploy the Worker. Do not put the shared secret in a normal variable, source file, GitHub commit, or chat. The Worker uses Google Apps Script first when both Google settings are present. Existing Cloudflare Email Service and Resend paths remain as fallbacks.

For Preview testing, add the same two Google settings to the Preview environment. The Script Properties above already allow both the production and stable Preview origins.

## 3. Test new-account verification

1. Open https://resolveai.aflakshhr.workers.dev/login/
2. Choose **Create a public account** and complete the registration form.
3. Open the message titled **Verify your ResolveAI email**.
4. Select **Verify email address**. The browser will confirm the address and continue to the unit membership form.
5. Try signing in before verification in a separate browser: it must be rejected until the email link is used.
6. If the message does not arrive, return to the login page, choose the verification screen, and request another link.

## 4. Test password recovery

1. On the sign-in page choose **Forgot password?** and enter an existing account email.
2. Check its inbox and spam folder for **Reset your ResolveAI password**.
3. Open the link within 30 minutes, enter a new password of at least 12 characters, and sign in again.
4. Confirm that the old password no longer works. Existing sessions are revoked after a successful reset.

Google Apps Script's published quota for consumer Gmail accounts is currently 100 email recipients per day. This is suitable for a small deployment and testing, not bulk mail. Google may change quotas without notice. See [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) and [Web App deployment](https://developers.google.com/apps-script/guides/web).

## Important rollout notes

- Apps Script sends from the Gmail account that owns the script; it does not create a custom `no-reply` domain sender.
- The first Apps Script deployment requires the account owner to authorize sending.
- If Google does not offer **Anyone** access for the Web App, the endpoint cannot be called by the Cloudflare Worker as configured.
- The first public signup is email-verified before sign-in. The initial administrator setup and existing legacy accounts are not blocked by this public-registration check.
- Never share verification links, reset links, the shared secret, Google credentials, or Cloudflare secrets.
