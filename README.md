# ResolveAI

ResolveAI is a customer-support dashboard prototype with a responsive web interface and a shared Expo / React Native mobile app.

## Run the web app locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build the web PWA

```bash
npm install
npm run build
```

The Next.js static export is written to `out/`. The PWA service worker and offline page are included in the export.

## Deploy to Cloudflare Workers

The repository includes `wrangler.jsonc` and `worker.js`. The Worker serves the static export from `out/` and handles the same-origin `/api/ai` endpoint. Set the `OPENAI_API_KEY` secret on the `resolveai` Worker before using live AI.

In Cloudflare Workers Builds, use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`

The Cloudflare account must be connected and authorized to deploy this Worker. Do not change or reuse any unrelated Worker or database.

## Dedicated D1 database foundation

A first database migration is available at `migrations/0001_initial.sql`. It defines isolated tables for users, workspaces, memberships, sessions, conversations and messages. Follow [docs/D1_SETUP.md](docs/D1_SETUP.md) to create a **new `resolveai-db` database** and bind it to the `resolveai` Worker. Never use `block17-db`. The migration is only a schema foundation: authentication, email verification, authorization and persistent API routes are not yet complete, so this does not make the demo safe for real customer data.

## Mobile app

The single shared Android / iOS app lives in `mobile/`. See [mobile/README.md](mobile/README.md) for Expo development and EAS build instructions.

## Important prototype limitations

The inbox, conversations, analytics and contacts still use local sample data; replies and status changes are only stored in browser memory. The AI Copilot can call the OpenAI Responses API through the Worker when the `OPENAI_API_KEY` secret is configured. The public demo does not yet have user authentication or durable rate limiting, so do not expose it to real customer traffic or sensitive data. There is no shared database, customer messaging provider or push notification service yet. The mobile app is also a UI prototype and is not yet connected to a production backend.

Do not use this prototype to handle real customer data until authentication, authorization, persistence, privacy controls, monitoring and real integrations have been implemented and tested. Never expose API keys in client-side code.
