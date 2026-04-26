"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message || "Ein unbekannter Fehler ist aufgetreten."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
