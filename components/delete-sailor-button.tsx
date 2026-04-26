"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteSailor } from "@/lib/actions/sailors";

export function DeleteSailorButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Segler wirklich löschen?")) return;
    startTransition(async () => {
      const result = await deleteSailor(id);
      if (result.ok) {
        router.push("/admin/segler");
      } else {
        alert("Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={disabled || isPending}
      title={disabled ? "Segler hat Regatta-Einträge und kann nicht gelöscht werden" : undefined}
    >
      {isPending ? "Löschen…" : "Löschen"}
    </Button>
  );
}
