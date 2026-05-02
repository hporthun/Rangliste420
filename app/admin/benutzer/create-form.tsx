"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "@/lib/actions/users";

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR">("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function submit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createUserAction({ username, email, password, role });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`Benutzer „${username}" angelegt.`);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("EDITOR");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Benutzername
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input text-sm w-full"
            placeholder="z.B. j.schmidt"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            E-Mail (optional)
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input text-sm w-full"
            placeholder="name@verein.de"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Initialpasswort (≥ 10 Zeichen)
          </span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input text-sm w-full font-mono"
            autoComplete="new-password"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Rolle
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "EDITOR")}
            className="input text-sm w-full"
          >
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !username || !password}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Lege an…" : "Benutzer anlegen"}
        </button>
        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
        {success && (
          <span className="text-sm text-green-700">{success}</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Das Initialpasswort wird einmalig im Klartext eingegeben und sofort
        gehasht gespeichert. Teile es dem neuen Benutzer auf einem sicheren Kanal
        mit. Im Konto-Bereich kann er es jederzeit selbst ändern.
      </p>
    </div>
  );
}
