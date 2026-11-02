import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResolveAI Customer Support",
    short_name: "ResolveAI",
    description: "A calmer way to support every customer.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fc",
    theme_color: "#635bff",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
