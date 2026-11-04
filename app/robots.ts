import type { MetadataRoute } from "next";

export const dynamic = "force-static";
export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/website/", "/qr/"],
      disallow: ["/api/", "/login/", "/membership/", "/admin/"]
    },
    sitemap: "https://resolveai.aflakshhr.workers.dev/sitemap.xml"
  };
}
