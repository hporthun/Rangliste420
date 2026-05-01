import Link from "next/link";
import Image from "next/image";
import { PublicNav } from "./public-nav";
import { DevWarningBanner } from "./dev-warning-banner";
import { PushBanner } from "@/components/push-banner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="maritime-header">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex items-center gap-3 sm:gap-6 h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logo-420-full.png"
              alt="420er Klasse"
              width={249}
              height={108}
              className="h-10 w-auto group-hover:opacity-90 transition-opacity"
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

      <DevWarningBanner />
      <PushBanner />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {children}
      </main>

      <footer className="border-t border-border/50 py-3 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            420er Rangliste · DSV-Ranglistensystem ·{" "}
            <span className="whitespace-nowrap">
              Powered by{" "}
              <a
                href="https://pt-systemhaus.de"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Porthun &amp; Thiede Systemhaus
              </a>
            </span>
          </span>
          <span className="flex items-center gap-3">
            <a
              href="https://pt-systemhaus.de/impressum"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Impressum
            </a>
            <a
              href="https://pt-systemhaus.de/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Datenschutz
            </a>
            <a
              href="/admin"
              className="hover:text-foreground transition-colors"
            >
              Admin-Zugang →
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
