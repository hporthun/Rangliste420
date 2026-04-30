/**
 * Server-Action: Changelog-Read-Marker setzen.
 *
 * `markChangelogReadAction` setzt `User.lastReadChangelogVersion` auf den
 * aktuellen `APP_VERSION` — danach unterdrückt das Admin-Layout das
 * Changelog-Popup, bis ein neuer Eintrag mit höherer Version published
 * wird. Compare-Logic in `lib/changelog.tsx`:`compareVersions`.
 */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { APP_VERSION } from "@/lib/version";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Mark all currently visible changelog entries as read for the current user
 * by storing the current APP_VERSION on the user record. The next time the
 * user logs in, the popup will only re-appear if a release with a higher
 * version has been published.
 */
export async function markChangelogReadAction(): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Nicht angemeldet." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { lastReadChangelogVersion: APP_VERSION },
  });

  return { ok: true };
}
