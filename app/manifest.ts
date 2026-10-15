import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ramein",
    short_name: "Ramein",
    description: "Bikin kota makin rame, bareng-bareng.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#17212B",
    icons: [
      { src: "/icons/ramein-ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/ramein-ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/ramein-ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
