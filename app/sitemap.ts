import type { MetadataRoute } from "next";

export const dynamic = "force-static";
export const revalidate = false;

const baseUrl = "https://resolveai.aflakshhr.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl + "/", changeFrequency: "weekly", priority: 1 },
    { url: baseUrl + "/website/", changeFrequency: "weekly", priority: 0.9 },
    { url: baseUrl + "/qr/", changeFrequency: "monthly", priority: 0.6 }
  ];
}
