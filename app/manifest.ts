/**
 * Progressive Web App manifest.
 *
 * Tells the browser how to render the app when installed to the home screen
 * (iOS) or as a standalone PWA (Android, desktop). Explicitly references the
 * 420er-Klasse logo so the install prompt and home-screen icon match the
 * brand instead of falling back to a generic Next.js placeholder. (Issue #30)
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "420er Rangliste",
    short_name: "420er",
    description: "DSV-Ranglistensystem für die deutsche 420er-Klasse",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    // Same maritime blue used in the in-app header gradient.
    theme_color: "#1B3C8E",
    icons: [
      {
        src: "/logo-420.png",
        sizes: "1000x665",
        type: "image/png",
        purpose: "any",
      },
      {
        // SVG icon scales to whatever size the OS asks for.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
