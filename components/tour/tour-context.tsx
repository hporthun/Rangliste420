"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ── Step definitions ──────────────────────────────────────────────────────────

export type TourPlacement = "bottom" | "bottom-end" | "center";

export type TourStep = {
  id: string;
  /** CSS selector for the element to highlight. null = centered modal, no highlight. */
  target: string | null;
  title: string;
  content: string;
  placement: TourPlacement;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Willkommen im 420er-Admin 👋",
    content:
      "Diese kurze Führung zeigt dir alle wichtigen Funktionen. " +
      'Du kannst sie jederzeit mit "Überspringen" beenden und später über den ' +
      '"Tour"-Button neu starten.',
    placement: "center",
  },
  {
    id: "nav-segler",
    target: '[data-tour="nav-segler"]',
    title: "Segler verwalten",
    content:
      "Hier legst du Segler an und pflegst Stammdaten wie Geburtsjahr und Geschlecht. " +
      "Vollständige Daten sind für Alterskategorie-Ranglisten (U15–U19) erforderlich. " +
      "Segler ohne Geburtsjahr erscheinen nur in der Open-Kategorie.",
    placement: "bottom",
  },
  {
    id: "nav-regatten",
    target: '[data-tour="nav-regatten"]',
    title: "Regatten",
    content:
      "Alle Regatten mit Ranglistenfaktor f (0,80–2,60), Wettfahrtenanzahl und " +
      'Manage2Sail-URL. Über den orangenen "Ergebnisse importieren"-Button startest ' +
      "du den Import-Wizard direkt aus der Regattenliste.",
    placement: "bottom",
  },
  {
    id: "nav-ranglisten",
    target: '[data-tour="nav-ranglisten"]',
    title: "Ranglisten erstellen",
    content:
      "Erstelle DSV-Ranglisten nach RO Anlage 1 §2 (gültig ab 01.01.2026): " +
      "Jahresrangliste (Snapshot 30.11.), Aktuelle Rangliste (on-demand) oder " +
      "IDJM-Quali (U16/U19, R ≥ 25). Die Formel: R_A = f × 100 × ((s+1−x)/s).",
    placement: "bottom",
  },
  {
    id: "nav-wartung",
    target: '[data-tour="nav-wartung"]',
    title: "Wartung & Backup",
    content:
      "Automatische und manuelle Datensicherung, Rücksicherung direkt vom Server, " +
      "Datenreduktion nach Jahr und das Sicherheitsprotokoll aller Admin-Aktionen.",
    placement: "bottom",
  },
  {
    id: "nav-hilfe",
    target: '[data-tour="nav-hilfe"]',
    title: "Hilfe & Dokumentation",
    content:
      "Das vollständige Benutzerhandbuch: DSV-Formel, Multiplikator-Staffel, " +
      "Fuzzy-Matching-Logik, Import-Schritt-für-Schritt und alle Fachbegriffe " +
      "mit einem klickbaren Inhaltsverzeichnis.",
    placement: "bottom-end",
  },
  {
    id: "done",
    target: null,
    title: "Alles klar! 🎉",
    content:
      'Du kannst die Tour jederzeit über den "Tour"-Button in der ' +
      "Navigationsleiste neu starten. Viel Erfolg!",
    placement: "center",
  },
];

// ── Context ───────────────────────────────────────────────────────────────────

type TourContextValue = {
  isOpen: boolean;
  step: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  closeTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

const LS_KEY = "420-tour-seen";

export function TourProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-start for first-time users (after a short delay so the page renders first)
  useEffect(() => {
    const seen = typeof localStorage !== "undefined" && localStorage.getItem(LS_KEY);
    if (!seen) {
      const t = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const startTour = useCallback(() => {
    setStep(0);
    setIsOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    setStep((s) => {
      const next = s + 1;
      if (next >= TOUR_STEPS.length) {
        setIsOpen(false);
        if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, "1");
        return 0;
      }
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, "1");
    setStep(0);
  }, []);

  return (
    <TourContext.Provider
      value={{
        isOpen,
        step,
        totalSteps: TOUR_STEPS.length,
        startTour,
        nextStep,
        prevStep,
        closeTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
