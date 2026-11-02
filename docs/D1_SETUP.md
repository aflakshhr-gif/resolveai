# ResolveAI private workspace database setup

This setup is isolated to the dedicated ResolveAI database. Never select, rename, migrate, or reuse `block17-db`.

## Dedicated database

The Cloudflare Worker configuration now binds `DB` to the dedicated database `resolveai-db`. The configured database ID is the one created for ResolveAI.

## Apply database migrations

After the `DB` binding is available, run both migrations against the dedicated database, in order:

```bash
npx wrangler d1 migrations apply resolveai-db --remote
```

The migrations create users, workspaces, team membership, hashed-password session storage, conversations, messages, and one-time team invitations. The command must target exactly `resolveai-db`.

## Enable first-owner setup

In Cloudflare Dashboard, open **Workers & Pages → resolveai → Settings → Variables and secrets**. Add a secret named `RESOLVEAI_SETUP_TOKEN` with a long, random value. Do not share this value in chat or screenshots.

The first person to open the private app completes the one-time owner setup using that secret. Once the first account exists, setup is permanently closed. Public registration is disabled.

## Invite teammates

After signing in as owner or admin, open **Team**, create an invitation for a specific email and role, and share the generated one-time link privately. Invitations expire after seven days. Available roles are admin, agent, and viewer.

## Security notes

- Passwords are stored as PBKDF2-SHA-256 hashes with per-user random salts, never as plaintext.
- Sessions use random opaque tokens; only token hashes are stored in D1. Session cookies are HttpOnly, Secure, and SameSite=Lax.
- The app disables service-worker caching to avoid retaining private workspace pages on shared devices.
- Initial setup requires the Cloudflare secret and can only happen while the users table is empty.
- This is the first private-access foundation. Conversation persistence, full role enforcement on every workspace action, password reset, email delivery/verification, audit logs, and production security review remain follow-up work. Do not store real customer conversations until those are implemented and tested.
- Never use the Block 17 Worker or database for ResolveAI.
