"use client";

import { Compass } from "lucide-react";
import { useTour } from "./tour-context";

export function TourButton() {
  const { startTour } = useTour();
  return (
    <button
      onClick={startTour}
      title="Interaktive Tour starten"
      className="px-3 py-1.5 text-sm rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1.5"
    >
      <Compass className="h-4 w-4" />
      <span className="hidden sm:inline">Tour</span>
    </button>
  );
}
