"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs text-muted-foreground hover:text-foreground border rounded px-2.5 py-1 transition-colors print:hidden"
    >
      Drucken / Als PDF speichern
    </button>
  );
}
