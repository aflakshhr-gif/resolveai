"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    }).catch(() => undefined);
    if ("caches" in window) {
      caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("resolveai-")).map(key => caches.delete(key)))).catch(() => undefined);
    }
  }, []);
  return null;
}
