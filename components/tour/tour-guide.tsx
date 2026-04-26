"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTour, TOUR_STEPS } from "./tour-context";

// ── Geometry ──────────────────────────────────────────────────────────────────

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8; // px around the highlighted element
const TOOLTIP_W = 360; // max tooltip width in px

function getRect(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipStyle(
  rect: Rect | null,
  placement: string,
): React.CSSProperties {
  if (!rect || placement === "center") {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.min(TOOLTIP_W, window.innerWidth - 32),
    };
  }

  const spotBottom = rect.top + rect.height + PADDING;
  const spotLeft   = rect.left - PADDING;
  const spotRight  = rect.left + rect.width + PADDING;

  if (placement === "bottom-end") {
    // Align tooltip's right edge to spotlight's right edge
    return {
      position: "fixed",
      top:   spotBottom + 12,
      right: window.innerWidth - spotRight,
      width: Math.min(TOOLTIP_W, window.innerWidth - 32),
    };
  }

  // "bottom" — align left edge, but clamp so it doesn't overflow right
  const left = Math.min(spotLeft, window.innerWidth - TOOLTIP_W - 16);
  return {
    position: "fixed",
    top:  spotBottom + 12,
    left: Math.max(8, left),
    width: Math.min(TOOLTIP_W, window.innerWidth - 32),
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export function TourGuide() {
  const { isOpen, step, totalSteps, nextStep, prevStep, closeTour } = useTour();

  const currentStep = TOUR_STEPS[step];
  const [rect, setRect] = useState<Rect | null>(null);

  // Re-measure on step change and on resize
  const measure = useCallback(() => {
    if (!isOpen || !currentStep?.target) {
      setRect(null);
      return;
    }
    setRect(getRect(currentStep.target));
  }, [isOpen, currentStep]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeTour(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeTour]);

  if (!isOpen || !currentStep) return null;

  const isFirst  = step === 0;
  const isLast   = step === totalSteps - 1;
  const hasTarget = !!currentStep.target && rect !== null;

  // Spotlight box (creates the dimmed overlay via box-shadow)
  const spotStyle: React.CSSProperties = hasTarget
    ? {
        position: "fixed",
        top:    rect!.top  - PADDING,
        left:   rect!.left - PADDING,
        width:  rect!.width  + PADDING * 2,
        height: rect!.height + PADDING * 2,
        borderRadius: 8,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        zIndex: 9900,
        pointerEvents: "none",
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
      }
    : {
        // No target → full-screen backdrop only (the tooltip is centered)
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9900,
        pointerEvents: "none",
      };

  return (
    <>
      {/* Backdrop / spotlight */}
      <div style={spotStyle} aria-hidden="true" />

      {/* Invisible click-catcher for the backdrop (click outside = close) */}
      {hasTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9899 }}
          onClick={closeTour}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card */}
      <div
        style={{ ...tooltipStyle(rect, currentStep.placement), zIndex: 9950 }}
        role="dialog"
        aria-modal="true"
        aria-label={currentStep.title}
        className="rounded-xl border border-border bg-background shadow-2xl p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {/* Progress dots */}
            <div className="flex gap-1 mb-2">
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`inline-block rounded-full transition-all ${
                    i === step
                      ? "w-4 h-1.5 bg-primary"
                      : "w-1.5 h-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <h2 className="text-base font-semibold leading-tight">{currentStep.title}</h2>
          </div>
          <button
            onClick={closeTour}
            className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
            aria-label="Tour schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {currentStep.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={closeTour}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Überspringen
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Zurück
              </button>
            )}
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-1 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
            >
              {isLast ? "Fertig" : "Weiter"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
