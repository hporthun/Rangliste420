import Link from "next/link";
import { WifiOff } from "lucide-react";

/**
 * Offline-Fallback für die öffentliche App.
 *
 * Wird vom Service Worker (public/sw.js) als letzter Ausweg ausgeliefert,
 * wenn eine Navigation kein Netz hat UND die Zielseite nicht im Page-Cache
 * liegt. Bereits besuchte Seiten kommen weiterhin aus dem Cache; diese
 * Seite sieht nur, wer ohne Netz auf eine fremde Route navigiert.
 */
export const metadata = {
  title: "Offline · 420er Rangliste",
};

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-5">
      <WifiOff
        className="h-12 w-12 text-muted-foreground mx-auto"
        aria-hidden
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        Keine Verbindung
      </h1>
      <p className="text-muted-foreground leading-relaxed">
        Du bist gerade offline. Bereits besuchte Seiten kannst du weiterhin
        ansehen — neue Inhalte sind erst wieder verfügbar, sobald die
        Verbindung zurück ist.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Link
          href="/rangliste"
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Ranglisten
        </Link>
        <Link
          href="/regatten"
          className="px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted"
        >
          Regatten
        </Link>
      </div>
    </div>
  );
}
