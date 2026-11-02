# ResolveAI D1 database setup

This setup is intentionally isolated to a **new database dedicated to ResolveAI**.
Never select, rename, migrate, or reuse the existing `block17-db` database.

## 1. Create a dedicated database

In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database → Create database**.
Use the name `resolveai-db`. Do not choose an existing database.

## 2. Add the Worker binding

Open **Workers & Pages → resolveai → Settings → Bindings → Add → D1 database**.
Set the variable name to `DB` and select only the newly created `resolveai-db`.
Save and deploy the `resolveai` Worker.

The repository does not contain a database ID yet, and no binding is active until this step is completed.

## 3. Apply the schema

From the repository root, after installing Wrangler and authenticating the Cloudflare account:

```bash
npx wrangler d1 migrations apply resolveai-db --remote
```

The migration is in `migrations/0001_initial.sql`. It creates isolated tables for users, workspaces, memberships, sessions, conversations, and messages, plus lookup indexes.

## Important security status

- This migration is a data-model foundation, not a complete authentication implementation.
- Password columns are reserved for a future password-hashing implementation; never store plaintext passwords.
- Email verification, account recovery, session issuance/revocation, authorization checks, and API persistence routes must be implemented and tested before real customer data is used.
- Do not put real customer data into the current demo.
- No command in this guide targets or changes `block17` or `block17-db`.
