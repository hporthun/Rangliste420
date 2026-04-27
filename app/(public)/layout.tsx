import Link from "next/link";
import Image from "next/image";
import { PublicNav } from "./public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="maritime-header">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-6 h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
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
              <span className="font-normal text-white/75 text-xs">Rangliste</span>
            </span>
          </Link>
          <PublicNav />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {children}
      </main>

      <footer className="border-t border-border/50 py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>420er Rangliste · DSV-Ranglistensystem</span>
          <a
            href="/admin"
            className="hover:text-foreground transition-colors"
          >
            Admin-Zugang →
          </a>
        </div>
      </footer>
    </div>
  );
}
