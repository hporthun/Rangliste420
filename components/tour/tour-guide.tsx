"use client";

import { useTour, TOUR_STEPS } from "./tour-context";
import { TourOverlay } from "./tour-overlay";

/** Global navigation tour — spotlights the main admin nav links. */
export function TourGuide() {
  const { isOpen, step, nextStep, prevStep, closeTour } = useTour();

  return (
    <TourOverlay
      steps={TOUR_STEPS}
      step={step}
      isOpen={isOpen}
      onNext={nextStep}
      onPrev={prevStep}
      onClose={closeTour}
    />
  );
}
