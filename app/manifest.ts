import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gasyu",
    short_name: "Gasyu",
    description: "Bikin kota makin rame, bareng-bareng.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F3F1",
    theme_color: "#F3F3F1",
    icons: [
      { src: "/icons/gasyu-ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/gasyu-ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/gasyu-ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
