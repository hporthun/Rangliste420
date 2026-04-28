"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Regatta } from "@prisma/client";

type Props = {
  action: (data: FormData) => Promise<{ ok: boolean; error?: unknown }>;
  regatta?: Regatta;
};

const COUNTRIES = ["GER", "DEN", "AUT", "SUI", "NED", "FRA", "GBR", "SWE", "NOR", "FIN", "ESP", "ITA", "POL", "CZE", "HUN"];

function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function RegattaForm({ action, regatta }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState(regatta?.sourceUrl ?? "");
  const isM2sUrl = sourceUrl.includes("manage2sail.com");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setError("Fehler beim Speichern. Bitte Felder prüfen.");
        return;
      }
      router.push("/admin/regatten");
    });
  }

  const faktor = regatta ? Number(regatta.ranglistenFaktor) : 1.0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <Field label="Name *">
        <input name="name" defaultValue={regatta?.name ?? ""} required className="input" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Ort">
          <input name="location" defaultValue={regatta?.location ?? ""} className="input" />
        </Field>
        <Field label="Land">
          <select name="country" defaultValue={regatta?.country ?? "GER"} className="input">
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Startdatum *">
          <input
            name="startDate"
            type="date"
            defaultValue={toDateInput(regatta?.startDate)}
            required
            className="input"
          />
        </Field>
        <Field label="Enddatum *">
          <input
            name="endDate"
            type="date"
            defaultValue={toDateInput(regatta?.endDate)}
            required
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Geplante Wettfahrten">
          <input
            name="plannedRaces"
            type="number"
            min={0}
            defaultValue={regatta?.plannedRaces ?? ""}
            className="input"
            placeholder="—"
          />
        </Field>
        <Field label="Gefahrene Wettfahrten *">
          <input
            name="completedRaces"
            type="number"
            min={0}
            defaultValue={regatta?.completedRaces ?? 0}
            required
            className="input"
          />
        </Field>
        <Field label="Ranglistenfaktor f *">
          <input
            name="ranglistenFaktor"
            type="number"
            step="0.05"
            min={0.8}
            max={2.6}
            defaultValue={faktor.toFixed(2)}
            required
            className="input"
          />
          <p className="text-xs text-muted-foreground mt-1">0,80 – 2,60</p>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Wertungssystem">
          <select name="scoringSystem" defaultValue={regatta?.scoringSystem ?? "LOW_POINT"} className="input">
            <option value="LOW_POINT">Low Point</option>
            <option value="BONUS_POINT">Bonus Point</option>
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isRanglistenRegatta"
            defaultChecked={regatta?.isRanglistenRegatta ?? false}
            className="rounded border-input"
          />
          Ranglistenregatta (420er-KV anerkannt)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="multiDayAnnouncement"
            defaultChecked={regatta?.multiDayAnnouncement ?? false}
            className="rounded border-input"
          />
          Mehrtages-Ausschreibung (m=5 ab 6 Wettfahrten)
        </label>
      </div>

      <Field label="Manage2Sail-URL">
        <div className="flex gap-2">
          <input
            name="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.manage2sail.com/..."
            className="input flex-1"
          />
          {regatta?.id && isM2sUrl && (
            <a
              href={`/admin/import?regattaId=${regatta.id}&m2sUrl=${encodeURIComponent(sourceUrl)}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              ↓ Importieren
            </a>
          )}
        </div>
      </Field>

      <Field label="Notizen">
        <textarea
          name="notes"
          defaultValue={regatta?.notes ?? ""}
          rows={3}
          className="input resize-y"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/regatten")}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
