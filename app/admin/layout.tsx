import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav, HilfeLink, AdminMobileMenu } from "@/components/admin/admin-nav";
import { AdminUserMenu } from "@/components/admin/user-menu";
import { TourProvider } from "@/components/tour/tour-context";
import { TourGuide } from "@/components/tour/tour-guide";
import { TourButton } from "@/components/tour/tour-button";
import { ChangelogPopup } from "@/components/admin/changelog-popup";
import { APP_VERSION } from "@/lib/version";
import { db } from "@/lib/db/client";
import { unreadEntries } from "@/lib/changelog";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  // Compute unread changelog entries for the popup. Only the latest version
  // is read from the user record; the comparison happens in lib/changelog.tsx.
  const userId = session.user?.id;
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { lastReadChangelogVersion: true },
      })
    : null;
  const unread = unreadEntries(user?.lastReadChangelogVersion ?? null);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/auth/login" });
  }

  return (
    <TourProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* ── Maritime header ───────────────────────────────────────────── */}
        <header className="maritime-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between h-14 gap-2">
            {/* Brand + Nav */}
            <div className="flex items-center gap-3 md:gap-8 min-w-0">
              <AdminMobileMenu />
              <Link href="/admin" className="flex items-center gap-2.5 group shrink-0">
                <Image
                  src="/logo-420.png"
                  alt="420er Klasse"
                  width={1000}
                  height={665}
                  className="h-8 w-auto rounded-sm ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
                  priority
                />
                <span className="font-semibold text-white tracking-tight text-sm leading-tight">
                  420er<br />
                  <span className="font-normal text-white/60 text-xs">Admin</span>
                </span>
              </Link>
              <AdminNav />
            </div>

            {/* Right side: Tour + Hilfe + user menu */}
            <div className="flex items-center gap-1 shrink-0">
              <TourButton />
              <HilfeLink />
              <AdminUserMenu
                username={session.user?.username ?? session.user?.name ?? ""}
                email={session.user?.email ?? ""}
                signOutAction={signOutAction}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 w-full">
          {children}
        </main>

        <footer className="border-t border-border/50 py-3 text-center text-xs text-muted-foreground">
          <span>420er Rangliste · DSV-Ranglistensystem</span>
          <span className="mx-2 opacity-30">·</span>
          <Link
            href="/admin/changelog"
            className="font-mono hover:text-foreground transition-colors"
            title="Änderungsverlauf anzeigen"
          >
            v{APP_VERSION}
          </Link>
        </footer>
      </div>

      {/* Tour overlay renders on top of everything */}
      <TourGuide />

      {/* Changelog popup (renders only if user has unread entries) */}
      <ChangelogPopup entries={unread} />
    </TourProvider>
  );
}
