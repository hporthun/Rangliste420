"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/auth";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="currentPassword">
          Aktuelles Passwort
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="input w-full"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="newPassword">
          Neues Passwort
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input w-full"
        />
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          Neues Passwort bestätigen
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="input w-full"
        />
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2">
          Passwort erfolgreich geändert.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Wird gespeichert…" : "Passwort ändern"}
      </button>
    </form>
  );
}
