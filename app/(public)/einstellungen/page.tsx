/**
 * Oeffentliche Einstellungsseite (anonym zugaenglich).
 *
 * Aktuell ein einziger Abschnitt "Darstellung und Benachrichtigungen":
 *   - Theme-Picker (Hell / Dunkel / Auto)
 *   - Push-Benachrichtigungen aktivieren / abbestellen
 *
 * Die Komponenten sind komplett client-seitig und benoetigen keinen Login —
 * Theme wird in localStorage abgelegt, Push-Subscription im Browser + DB
 * (anonym, identifiziert nur per Endpoint).
 */
import { Palette } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushAccountSection } from "@/components/admin/push-account-section";

export const metadata = {
  title: "Einstellungen — 420er Rangliste",
};

export default function EinstellungenPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Persoenliche Anpassungen — werden in deinem Browser gespeichert.
        </p>
      </div>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
          <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="font-semibold text-sm">
            Darstellung und Benachrichtigungen
          </h2>
        </div>
        <div className="p-5 space-y-6">
          {/* Darstellung */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Farbschema</h3>
            <p className="text-xs text-muted-foreground">
              Hell, Dunkel oder automatisch nach Systemeinstellung.
            </p>
            <ThemeToggle variant="panel" />
          </div>

          <hr className="border-border/60" />

          {/* Benachrichtigungen */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Push-Benachrichtigungen</h3>
            <PushAccountSection />
          </div>
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Hinweis: Theme-Wahl und Push-Subscription gelten jeweils nur fuer
        diesen Browser. Beim Wechsel auf ein anderes Geraet musst du sie dort
        neu setzen.
      </p>
    </div>
  );
}
