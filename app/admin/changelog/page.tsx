/**
 * Changelog page — renders the full release-note history.
 *
 * Source of truth lives in lib/changelog.tsx so that the after-login popup
 * can reuse the same data.  When you add an entry, edit only that file.
 */
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";
import { ENTRIES, KIND_LABELS, KIND_CLASSES } from "@/lib/changelog";

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl font-bold mt-1">Änderungsverlauf</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aktuelle Version: <span className="font-mono font-medium text-foreground">v{APP_VERSION}</span>
        </p>
      </div>

      <div className="space-y-8">
        {ENTRIES.map((entry) => (
          <article
            key={entry.version}
            className="rounded-lg border bg-card p-5 space-y-3"
          >
            <header className="flex items-baseline justify-between gap-3 pb-2 border-b">
              <h2 className="text-lg font-semibold">
                v{entry.version}
                {entry.title && (
                  <span className="ml-2 font-normal text-base text-muted-foreground">
                    — {entry.title}
                  </span>
                )}
              </h2>
              <time
                dateTime={entry.date}
                className="text-xs font-mono text-muted-foreground tabular-nums shrink-0"
              >
                {new Date(entry.date).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </time>
            </header>

            {entry.changes.map((change, ci) => (
              <section key={ci} className="space-y-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${KIND_CLASSES[change.kind]}`}
                >
                  {KIND_LABELS[change.kind]}
                </span>
                <ul className="ml-1 space-y-1.5 text-sm">
                  {change.items.map((item, ii) => (
                    <li key={ii} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Ab 2026.04.1:{" "}
        <a
          href="https://calver.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Calendar Versioning
        </a>{" "}
        (JJJJ.MM.N). Ältere Versionen folgen SemVer.{" "}
        Quelltext und vollständige Commit-Historie:{" "}
        <a
          href="https://git.pt-systemhaus.de/HPorthun/Rangliste420"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Gitea-Repo
        </a>
        .
      </p>
    </div>
  );
}
