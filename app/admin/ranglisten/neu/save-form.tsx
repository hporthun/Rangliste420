"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJahresranklisteAction, type ComputeParams } from "@/lib/actions/rankings";

type Props = {
  defaultName: string;
  params: ComputeParams;
  regattaIds: string[];
};

export function SaveRanklisteForm({ defaultName, params, regattaIds }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await saveJahresranklisteAction(name.trim(), params, regattaIds);
    if (result.ok) {
      router.push(`/admin/ranglisten`);
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border p-4 space-y-4 bg-gray-50">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase">Name der Rangliste</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input text-sm w-full"
          placeholder="z.B. Jahresrangliste 2025 Open/Open"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Wird gespeichert…" : "Jahresrangliste speichern"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-100"
        >
          Abbrechen
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Die Rangliste wird als Entwurf gespeichert und kann anschließend veröffentlicht werden.
      </p>
    </div>
  );
}
