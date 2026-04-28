"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X, CheckCircle2 } from "lucide-react";
import {
  type ChangelogEntry,
  KIND_LABELS,
  KIND_CLASSES,
} from "@/lib/changelog";
import { markChangelogReadAction } from "@/lib/actions/changelog";

type Props = {
  entries: ChangelogEntry[];
};

/**
 * Modal that surfaces changelog entries the current user hasn't acknowledged
 * yet. Renders nothing if there is nothing new to show. The "als gelesen
 * markieren"-button calls the server action which writes the current
 * APP_VERSION to the user record, then dismisses the dialog.
 */
export function ChangelogPopup({ entries }: Props) {
  const [open, setOpen] = useState(entries.length > 0);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function markRead() {
    startTransition(async () => {
      const res = await markChangelogReadAction();
      if (res.ok) setOpen(false);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-popup-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-card rounded-xl border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b bg-gradient-to-br from-card to-muted/30">
          <div className="min-w-0">
            <h2 id="changelog-popup-title" className="text-lg font-semibold leading-tight">
              {entries.length === 1 ? "Was ist neu?" : `${entries.length} neue Änderungen`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seit deinem letzten Besuch — Änderungen an der App.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Schließen ohne als gelesen zu markieren"
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-6">
          {entries.map((entry) => (
            <article key={entry.version} className="space-y-2">
              <header className="flex items-baseline justify-between gap-3 pb-2 border-b">
                <h3 className="text-base font-semibold">
                  v{entry.version}
                  {entry.title && (
                    <span className="ml-2 font-normal text-sm text-muted-foreground">
                      — {entry.title}
                    </span>
                  )}
                </h3>
                <time
                  dateTime={entry.date}
                  className="text-xs font-mono text-muted-foreground tabular-nums shrink-0"
                >
                  {new Date(entry.date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </time>
              </header>

              {entry.changes.map((change, ci) => (
                <section key={ci} className="space-y-1.5">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${KIND_CLASSES[change.kind]}`}
                  >
                    {KIND_LABELS[change.kind]}
                  </span>
                  <ul className="ml-1 space-y-1.5 text-sm">
                    {change.items.map((item, ii) => (
                      <li key={ii} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/admin/changelog"
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Vollständigen Änderungsverlauf öffnen →
          </Link>
          <button
            type="button"
            onClick={markRead}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {pending ? "Speichere…" : "Als gelesen markieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
