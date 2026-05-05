"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Sailor } from "@/generated/prisma/client";

type Props = {
  action: (data: FormData) => Promise<{ ok: boolean; error?: unknown }>;
  sailor?: Sailor;
};

const NATIONALITIES = ["GER", "DEN", "AUT", "SUI", "NED", "FRA", "GBR", "SWE", "NOR", "FIN", "ESP", "ITA", "POL", "CZE", "HUN"];

export function SailorForm({ action, sailor }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [gender, setGender] = useState<"M" | "F" | "">(
    (sailor?.gender as "M" | "F") ?? ""
  );
  const [genderHint, setGenderHint] = useState<string | null>(null);
  const [altNames, setAltNames] = useState<string[]>(() => {
    if (!sailor?.alternativeNames) return [];
    try {
      return JSON.parse(sailor.alternativeNames as string);
    } catch {
      return [];
    }
  });
  const [newAltName, setNewAltName] = useState("");
  const [genderDetected, setGenderDetected] = useState(false);

  async function handleFirstNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const firstName = e.target.value.trim();
    if (!firstName || gender) return; // don't overwrite if already set

    const res = await fetch(`/api/detect-gender?name=${encodeURIComponent(firstName)}`);
    const data: { gender: "M" | "F" | null; confidence: "sure" | "likely" | null } =
      await res.json();

    if (data.gender) {
      setGender(data.gender);
      setGenderDetected(true);
      setGenderHint(
        data.confidence === "sure"
          ? `Automatisch erkannt (${data.gender === "M" ? "männlich" : "weiblich"})`
          : `Wahrscheinlich ${data.gender === "M" ? "männlich" : "weiblich"} – bitte prüfen`
      );
    }
  }

  function handleGenderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setGender(e.target.value as "M" | "F" | "");
    setGenderHint(null);
    setGenderDetected(false);
  }

  function addAltName() {
    const name = newAltName.trim();
    if (name && !altNames.includes(name)) {
      setAltNames([...altNames, name]);
      setNewAltName("");
    }
  }

  function removeAltName(name: string) {
    setAltNames(altNames.filter((n) => n !== name));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("gender", gender);
    data.set("alternativeNames", JSON.stringify(altNames));

    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setError("Fehler beim Speichern. Bitte Felder prüfen.");
        return;
      }
      router.push("/admin/segler");
    });
  }

  const birthYearValue = sailor?.birthYear ?? "";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vorname *">
          <input
            name="firstName"
            defaultValue={sailor?.firstName ?? ""}
            onBlur={handleFirstNameBlur}
            required
            className="input"
          />
        </Field>
        <Field label="Nachname *">
          <input
            name="lastName"
            defaultValue={sailor?.lastName ?? ""}
            required
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Geburtsjahr">
          <input
            name="birthYear"
            type="number"
            min={1900}
            max={2020}
            defaultValue={birthYearValue}
            placeholder="z.B. 2007"
            className="input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ohne Geburtsjahr: kein Alters-Filter
          </p>
        </Field>

        <Field
          label="Geschlecht"
          hint={genderHint}
          hintType={genderDetected ? "auto" : undefined}
        >
          <select
            name="gender"
            value={gender}
            onChange={handleGenderChange}
            className="input"
          >
            <option value="">— nicht angegeben —</option>
            <option value="M">männlich</option>
            <option value="F">weiblich</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Ohne Geschlecht: kein Gender-Filter
          </p>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nationalität">
          <select name="nationality" defaultValue={sailor?.nationality ?? "GER"} className="input">
            {NATIONALITIES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Segelnummer / DSV-ID">
          <input
            name="sailingLicenseId"
            defaultValue={sailor?.sailingLicenseId ?? ""}
            className="input"
          />
        </Field>
      </div>

      <Field label="Verein">
        <input
          name="club"
          defaultValue={sailor?.club ?? ""}
          className="input"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          name="member420"
          defaultChecked={sailor?.member420 ?? true}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="font-medium">Mitglied 420er-Klassenvereinigung</span>
        <span className="text-muted-foreground font-normal">(Pflicht für JWM/JEM-Quali)</span>
      </label>

      <div>
        <label className="block text-sm font-medium mb-1">
          Alternative Namen{" "}
          <span className="text-muted-foreground font-normal">(für Fuzzy-Matching)</span>
        </label>
        <div className="space-y-1 mb-2">
          {altNames.map((name) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <span className="bg-muted rounded px-2 py-0.5">{name}</span>
              <button
                type="button"
                onClick={() => removeAltName(name)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newAltName}
            onChange={(e) => setNewAltName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAltName(); } }}
            placeholder="Alternativer Name"
            className="input flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addAltName}>
            Hinzufügen
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/segler")}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  hintType,
  children,
}: {
  label: string;
  hint?: string | null;
  hintType?: "auto";
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && (
        <p className={`text-xs mt-1 ${hintType === "auto" ? "text-blue-600" : "text-muted-foreground"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
