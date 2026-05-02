"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type UserListRow,
  updateUserAction,
  resetUserPasswordAction,
  disableUserAction,
  enableUserAction,
  revokeUserSessionsAction,
  deleteUserAction,
} from "@/lib/actions/users";

const LOGIN_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Passwort",
  LOGIN_PASSKEY: "Passkey",
  LOGIN_OAUTH: "OAuth",
};

export function UserRow({
  user,
  currentUserId,
}: {
  user: UserListRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form fields
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<"ADMIN" | "EDITOR">(user.role);

  // Password reset fields
  const [newPassword, setNewPassword] = useState("");

  const isSelf = user.id === currentUserId;

  function run(action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <tr key="main" className={user.disabledAt ? "bg-red-50/50" : ""}>
        <td className="px-4 py-2 align-top">
          <div className="font-medium">
            {user.username ?? "—"}
            {isSelf && (
              <span className="ml-1.5 text-[10px] font-normal text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 align-middle">
                du
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{user.email ?? "—"}</div>
        </td>
        <td className="px-4 py-2 align-top">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              user.role === "ADMIN"
                ? "bg-purple-50 text-purple-700 border border-purple-200"
                : "bg-slate-50 text-slate-700 border border-slate-200"
            }`}
          >
            {user.role}
          </span>
        </td>
        <td className="px-4 py-2 align-top">
          {user.disabledAt ? (
            <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
              gesperrt seit {new Date(user.disabledAt).toLocaleDateString("de-DE")}
            </span>
          ) : (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
              aktiv
            </span>
          )}
        </td>
        <td className="px-4 py-2 align-top text-xs">
          {user.lastLoginAt ? (
            <>
              <div>{new Date(user.lastLoginAt).toLocaleString("de-DE")}</div>
              <div className="text-muted-foreground">
                {LOGIN_LABELS[user.lastLoginAction ?? ""] ?? user.lastLoginAction ?? ""}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">noch nie</span>
          )}
        </td>
        <td className="px-4 py-2 align-top text-xs">
          <div>{user.totpEnabled ? "TOTP an" : "TOTP aus"}</div>
          <div className="text-muted-foreground">
            {user.passkeyCount} Passkey{user.passkeyCount === 1 ? "" : "s"}
          </div>
        </td>
        <td className="px-4 py-2 align-top text-right">
          <div className="inline-flex flex-wrap gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v);
                setResetting(false);
                setError(null);
              }}
              disabled={pending}
              className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
            >
              {editing ? "Schließen" : "Bearbeiten"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetting((v) => !v);
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
              className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
            >
              {resetting ? "Schließen" : "Passwort"}
            </button>
            {!isSelf && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Alle Sessions von „${user.username}" beenden? Der Benutzer wird beim nächsten Klick auf eine Admin-Seite ausgeloggt.`)) return;
                  run(() => revokeUserSessionsAction(user.id));
                }}
                disabled={pending}
                className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Rauswerfen
              </button>
            )}
            {!isSelf && (
              user.disabledAt ? (
                <button
                  type="button"
                  onClick={() => run(() => enableUserAction(user.id))}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Entsperren
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`„${user.username}" sperren? Der Benutzer kann sich danach nicht mehr einloggen.`)) return;
                    run(() => disableUserAction(user.id));
                  }}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Sperren
                </button>
              )
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`„${user.username}" dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
                  run(() => deleteUserAction(user.id));
                }}
                disabled={pending}
                className="text-xs px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Löschen
              </button>
            )}
          </div>
          {error && (
            <div className="text-xs text-red-600 mt-1.5 text-right">{error}</div>
          )}
        </td>
      </tr>

      {editing && (
        <tr key="edit" className="bg-muted/30">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Benutzername
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input text-sm w-full"
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
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Rolle
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "EDITOR")}
                  disabled={isSelf}
                  className="input text-sm w-full"
                  title={isSelf ? "Du kannst deine eigene Rolle nicht ändern." : undefined}
                >
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  run(() => updateUserAction({ id: user.id, username, email, role }))
                }
                disabled={pending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Speichere…" : "Speichern"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
            </div>
          </td>
        </tr>
      )}

      {resetting && (
        <tr key="reset" className="bg-muted/30">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2 max-w-md">
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Neues Passwort (≥ 10 Zeichen)
                </span>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input text-sm w-full font-mono"
                  autoComplete="new-password"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Das Passwort wird sofort gehasht gespeichert. Alle laufenden
                Sessions des Benutzers werden invalidiert.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    run(async () => {
                      const r = await resetUserPasswordAction(user.id, newPassword);
                      if (r.ok) {
                        setNewPassword("");
                        setResetting(false);
                      }
                      return r;
                    });
                  }}
                  disabled={pending || newPassword.length < 10}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {pending ? "Setze…" : "Passwort setzen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetting(false);
                    setNewPassword("");
                  }}
                  disabled={pending}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
