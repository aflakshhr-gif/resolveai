// Network-only service worker. No page caching or fake offline fallback.
self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("resolveai-")).map(k=>caches.delete(k)));await self.clients.claim()})()));