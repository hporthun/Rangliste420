"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
  newPassword: z.string().min(8, "Neues Passwort muss mindestens 8 Zeichen haben"),
  confirmPassword: z.string().min(1),
});

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: msg ?? "Ungültige Eingabe." };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "Neues Passwort und Bestätigung stimmen nicht überein." };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Benutzer nicht gefunden." };

  if (!user.passwordHash) return { ok: false, error: "Kein Passwort gesetzt." };
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Aktuelles Passwort ist falsch." };

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return { ok: true };
}
