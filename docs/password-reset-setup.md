# ResolveAI password-reset email setup (free Gmail bridge)

The Worker creates a one-time password-reset token, stores only its SHA-256 digest in D1, and expires the link after 30 minutes. The Google Apps Script bridge sends the link through the Gmail account that owns the script. No custom domain or paid email provider is required.

## 1. Create the Gmail mailer

1. Sign in to the Google account that should send ResolveAI reset messages.
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

The endpoint is publicly reachable because Cloudflare must call it without a Google login. It rejects requests without the long random shared secret, validates the recipient and exact reset-link origins, and never logs the request body or reset token. Keep the script project private; do not add untrusted editors.

## 2. Configure Cloudflare Production

Open **Workers & Pages → resolveai → Settings → Variables and Secrets** and add:

| Name | Type | Value |
|---|---|---|
| `GOOGLE_APPS_SCRIPT_URL` | Variable | The Apps Script Web app URL ending in `/exec` |
| `GOOGLE_APPS_SCRIPT_TOKEN` | Secret | The exact same random value used for `RESOLVEAI_SHARED_SECRET` |
| `RESOLVEAI_PUBLIC_URL` | Variable | `https://resolveai.aflakshhr.workers.dev` |

Save and deploy the Worker. Do not put the shared secret in a normal variable, source file, GitHub commit, or chat. The Worker uses Google Apps Script first when both Google settings are present. Existing Cloudflare Email Service and Resend paths remain as fallbacks.

For Preview testing, add the same two Google settings to the Preview environment. The Script Properties above already allow both the production and stable Preview origins.

## 3. Test password recovery

1. Open https://resolveai.aflakshhr.workers.dev/login/
2. Choose **Forgot password?** and enter an existing account email.
3. Check its inbox and spam folder for **Reset your ResolveAI password**.
4. Open the link within 30 minutes, enter a new password of at least 12 characters, and sign in again.
5. Confirm that the old password no longer works. Existing sessions are revoked after a successful reset.

Google Apps Script's published quota for consumer Gmail accounts is currently 100 email recipients per day. This is suitable for a small deployment and testing, not bulk mail. Google may change quotas without notice. See [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) and [Web App deployment](https://developers.google.com/apps-script/guides/web).

## Important rollout notes

- Apps Script sends from the Gmail account that owns the script; it does not create a custom `no-reply` domain sender.
- The first Apps Script deployment requires the account owner to authorize sending.
- If Google does not offer **Anyone** access for the Web App, the endpoint cannot be called by the Cloudflare Worker as configured.
- Public signup email verification is a separate feature. This bridge enables password-reset email only; it does not verify email addresses during registration.
- Never share the reset link, shared secret, Google credentials, or Cloudflare secrets.
