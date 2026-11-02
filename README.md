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

The repository includes `wrangler.jsonc`, configured to serve the static export from `out/` as the separate Worker named `resolveai`.

In Cloudflare Workers Builds, use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`

The Cloudflare account must be connected and authorized to deploy this Worker. Do not change or reuse any unrelated Worker or database.

## Mobile app

The single shared Android / iOS app lives in `mobile/`. See [mobile/README.md](mobile/README.md) for Expo development and EAS build instructions.

## Important prototype limitations

The current inbox, conversations, analytics, contacts and AI Copilot use local sample data. Replies and status changes are only stored in browser memory. There is no live authentication, shared database, customer messaging provider, push notification service, or real AI integration yet. The mobile app is also a UI prototype and is not yet connected to a production backend.

Do not use this prototype to handle real customer data until authentication, authorization, persistence, privacy controls, monitoring and real integrations have been implemented and tested. Never expose API keys in client-side code.
