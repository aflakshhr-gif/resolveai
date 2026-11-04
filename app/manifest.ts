import type { MetadataRoute } from "next";

export const dynamic = "force-static";
export const revalidate = false;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ResolveAI — Private Support Workspace",
    short_name: "ResolveAI",
    description: "Private support workspace for invited team members.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fc",
    theme_color: "#635bff",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
