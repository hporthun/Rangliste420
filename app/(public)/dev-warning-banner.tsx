/**
 * Sichtbarer Hinweis für Public-Seiten: Die App befindet sich noch in
 * der Entwicklung, angezeigte Ranglisten können noch fehlerhaft sein.
 *
 * Issue #34. Server-Component (kein Client-Code) — der Hinweis ist
 * absichtlich nicht ausblendbar, damit er auch bei wiederholten
 * Besuchen sichtbar bleibt, solange wir noch in der Beta-Phase sind.
 */
import { AlertTriangle } from "lucide-react";

export function DevWarningBanner() {
  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 text-amber-900"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 flex items-start gap-2 text-xs sm:text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
        <p className="leading-snug">
          <strong>Beta-Hinweis:</strong> Diese App ist noch in der
          Entwicklung. Die angezeigten Ranglisten und Berechnungen können
          fehlerhaft oder unvollständig sein und sind <strong>nicht</strong>{" "}
          als verbindliche Ergebnisse zu betrachten.
        </p>
      </div>
    </div>
  );
}
