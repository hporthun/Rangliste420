"use client";

/**
 * Self-contained, per-page tour component.
 * Render <PageTour steps={...} /> anywhere in a page (server or client component).
 * The steps array must be serializable (strings + null only) so it can cross
 * the server→client boundary.
 *
 * Each step targets an element via CSS selector in `target`.
 * Add matching data-tour="…" attributes to your page elements.
 */

import { useState, useCallback } from "react";
import { Compass } from "lucide-react";
import type { TourStep } from "./tour-context";
import { TourOverlay } from "./tour-overlay";

type Props = {
  steps: TourStep[];
  /** Button label. Defaults to "Seite erkunden". */
  label?: string;
};

export function PageTour({ steps, label = "Seite erkunden" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => { setStep(0); setIsOpen(true); }, []);

  const close = useCallback(() => { setIsOpen(false); setStep(0); }, []);

  const next = useCallback(() => {
    setStep((s) => {
      const n = s + 1;
      if (n >= steps.length) { setIsOpen(false); return 0; }
      return n;
    });
  }, [steps.length]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  if (steps.length === 0) return null;

  return (
    <>
      <button
        onClick={start}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground border border-input rounded-md hover:bg-muted hover:text-foreground transition-colors"
        title="Seitenführung starten"
      >
        <Compass className="h-3.5 w-3.5" />
        {label}
      </button>

      <TourOverlay
        steps={steps}
        step={step}
        isOpen={isOpen}
        onNext={next}
        onPrev={prev}
        onClose={close}
      />
    </>
  );
}
