/* eslint-disable react/no-unescaped-entities */
import { TocNav } from "./toc-client";
import { PrintButton } from "./print-button";

const TOC = [
  { id: "uebersicht",        label: "Übersicht",                    level: 1 },
  { id: "segler",            label: "Segler verwalten",             level: 1 },
  { id: "segler-anlegen",    label: "Segler anlegen",               level: 2 },
  { id: "segler-stammdaten", label: "Stammdaten & Felder",          level: 2 },
  { id: "segler-altnamen",   label: "Alternative Namen",            level: 2 },
  { id: "regatten",          label: "Regatten verwalten",           level: 1 },
  { id: "regatten-anlegen",  label: "Regatta anlegen",              level: 2 },
  { id: "regatten-felder",   label: "Felder & Faktor",              level: 2 },
  { id: "regatten-m2s",      label: "M2S-Abgleich",                 level: 2 },
  { id: "import",            label: "Ergebnisse importieren",       level: 1 },
  { id: "import-quelle",     label: "Importquellen",                level: 2 },
  { id: "import-matching",   label: "Fuzzy-Matching",               level: 2 },
  { id: "import-startarea",  label: "Startgebiet",                  level: 2 },
  { id: "ranglisten",        label: "Ranglisten",                   level: 1 },
  { id: "ranglisten-typen",  label: "Typen & Kategorien",           level: 2 },
  { id: "ranglisten-formel", label: "DSV-Formel",                   level: 2 },
  { id: "ranglisten-tiebreak","label": "Tiebreak",                  level: 2 },
  { id: "ranglisten-idjm",   label: "IDJM-Quali",                   level: 2 },
  { id: "wartung",           label: "Wartung",                      level: 1 },
  { id: "wartung-backup",    label: "Datensicherung",               level: 2 },
  { id: "wartung-restore",   label: "Rücksicherung",                level: 2 },
  { id: "wartung-pruning",   label: "Datenreduktion",               level: 2 },
];

// Pre-compute numbered TOC entries at module level (avoids mutation inside a component)
function buildNumberedToc() {
  let chapter = 0;
  let section = 0;
  return TOC.map((entry) => {
    if (entry.level === 1) {
      chapter += 1;
      section = 0;
      return { ...entry, num: `${chapter}.`, indent: false };
    } else {
      section += 1;
      return { ...entry, num: `${chapter}.${section}`, indent: true };
    }
  });
}
const NUMBERED_TOC = buildNumberedToc();

// ── Typography helpers ─────────────────────────────────────────────────────────

function H1({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold mt-10 mb-3 pb-2 border-b scroll-mt-20">
      {children}
    </h2>
  );
}
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-20">
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mb-3">{children}</ul>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="leading-relaxed">{children}</li>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-3">
      {children}
    </div>
  );
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-3">
      {children}
    </div>
  );
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{children}</code>
  );
}
/** Table of contents rendered only in print / PDF output */
function PrintToc() {
  return (
    <div className="hidden print:block mb-10 mt-4">
      <h2 className="text-base font-bold mb-3 pb-1 border-b">Inhaltsverzeichnis</h2>
      <ol className="space-y-1 text-sm">
        {NUMBERED_TOC.map((entry) => (
          <li
            key={entry.id}
            className={`flex items-baseline gap-2 ${entry.indent ? "pl-6" : ""}`}
          >
            <span
              className={`tabular-nums shrink-0 ${
                entry.indent ? "w-8 text-gray-500" : "w-6 font-semibold"
              }`}
            >
              {entry.num}
            </span>
            <a
              href={`#${entry.id}`}
              className={entry.indent ? "text-gray-700" : "font-semibold"}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Diagram components ─────────────────────────────────────────────────────────

/** Horizontal flow diagram for the 4-step admin workflow */
function WorkflowDiagram() {
  const steps = [
    { n: "1", label: "Regatten\nanlegen", icon: "📋" },
    { n: "2", label: "Ergebnisse\nimportieren", icon: "📥" },
    { n: "3", label: "Segler\nzuordnen", icon: "🔗" },
    { n: "4", label: "Rangliste\nerstellen", icon: "🏆" },
  ];
  return (
    <div className="my-4 rounded-lg border bg-muted/30 px-4 py-5">
      <div className="flex items-center justify-between gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <div className="flex flex-col items-center text-center flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                {s.n}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground whitespace-pre-line leading-tight">
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="text-muted-foreground/40 font-bold text-lg shrink-0 hidden sm:block">→</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3 pt-3 border-t border-border/50">
        Typischer Arbeitsablauf — Schritte 2–3 werden pro Regatta wiederholt
      </p>
    </div>
  );
}

/** Import wizard step indicator */
function ImportWizardSteps() {
  const steps = [
    { n: "1", label: "Quelle", desc: "Copy-Paste, URL oder PDF" },
    { n: "2", label: "Metadaten", desc: "Faktor, Wettfahrten prüfen" },
    { n: "3", label: "Matching", desc: "Segler zuordnen / anlegen" },
    { n: "4", label: "Vorschau & Speichern", desc: "Ergebnis bestätigen" },
  ];
  return (
    <div className="my-4 rounded-lg border bg-muted/30 px-4 py-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {steps.map((s, i) => (
          <div key={s.n} className="flex sm:flex-col items-start sm:items-center sm:text-center flex-1 gap-3 sm:gap-1.5">
            <div className="flex sm:flex-col items-center gap-2 sm:gap-1.5 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {s.n}
                </span>
                <span className="font-medium text-sm">{s.label}</span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">{s.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="text-muted-foreground/30 hidden sm:block text-2xl leading-none self-start mt-2">›</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fuzzy-matching threshold visualization */
function FuzzyThresholdBar() {
  return (
    <div className="my-4 rounded-lg border overflow-hidden">
      <div className="flex">
        <div className="flex-1 bg-green-50 border-r border-green-200 px-3 py-3 text-center">
          <div className="text-xs font-bold text-green-700 mb-0.5">≥ 90 %</div>
          <div className="text-xs text-green-600">Sehr wahrscheinlich</div>
          <div className="text-[10px] text-green-500 mt-1">Sammelbestätigung möglich</div>
        </div>
        <div className="flex-1 bg-amber-50 border-r border-amber-200 px-3 py-3 text-center">
          <div className="text-xs font-bold text-amber-700 mb-0.5">75 – 90 %</div>
          <div className="text-xs text-amber-600">Möglich</div>
          <div className="text-[10px] text-amber-500 mt-1">Manuelle Prüfung</div>
        </div>
        <div className="flex-1 bg-red-50 px-3 py-3 text-center">
          <div className="text-xs font-bold text-red-700 mb-0.5">{"< 75 %"}</div>
          <div className="text-xs text-red-600">Kein Vorschlag</div>
          <div className="text-[10px] text-red-500 mt-1">Suche oder Neu anlegen</div>
        </div>
      </div>
    </div>
  );
}

/** Multiplier m visualization */
function MultiplierTable() {
  const rows = [
    { races: "1 Wettfahrt", m: 1, bar: 1 },
    { races: "2 Wettfahrten", m: 2, bar: 2 },
    { races: "3 Wettfahrten", m: 3, bar: 3 },
    { races: "4–5 Wettfahrten", m: 4, bar: 4 },
    { races: "≥ 6 Wettfahrten + Mehrtages-Ausschreibung", m: 5, bar: 5 },
  ];
  return (
    <div className="my-3 rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <th className="px-3 py-2 text-left">Anzahl Wettfahrten</th>
            <th className="px-3 py-2 text-right w-16">m</th>
            <th className="px-3 py-2 text-left hidden sm:table-cell">Wertungen pro Regatta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {rows.map((r) => (
            <tr key={r.m} className={r.m === 5 ? "bg-blue-50/50" : ""}>
              <td className="px-3 py-2 text-sm text-muted-foreground">{r.races}</td>
              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{r.m}</td>
              <td className="px-3 py-2 hidden sm:table-cell">
                <div className="flex gap-1">
                  {Array.from({ length: r.bar }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 w-5 rounded-sm bg-accent/60"
                    />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** R_A formula breakdown */
function FormulaBreakdown() {
  return (
    <div className="my-4 rounded-lg border bg-muted/30 px-4 py-4">
      <div className="font-mono text-base text-center mb-4 font-semibold">
        R_A = f × 100 × ((s + 1 − x) / s)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-card border px-3 py-2">
          <span className="font-mono font-bold text-accent">f</span>
          <span className="text-muted-foreground ml-2">Ranglistenfaktor</span>
          <div className="text-xs text-muted-foreground mt-0.5">0,80 – 2,60</div>
        </div>
        <div className="rounded-md bg-card border px-3 py-2">
          <span className="font-mono font-bold text-accent">s</span>
          <span className="text-muted-foreground ml-2">Gestartete Boote</span>
          <div className="text-xs text-muted-foreground mt-0.5">inkl. DNS/BFD/OCS</div>
        </div>
        <div className="rounded-md bg-card border px-3 py-2">
          <span className="font-mono font-bold text-accent">x</span>
          <span className="text-muted-foreground ml-2">Gesamtplatz</span>
          <div className="text-xs text-muted-foreground mt-0.5">1 = Sieg → R_A maximal</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3 pt-3 border-t border-border/50">
        RO Anlage 1 §2 · DSV-Ranglistenordnung, gültig ab 01.01.2026
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HilfePage() {
  return (
    <div className="flex gap-10 items-start">
      {/* Sticky TOC */}
      <aside className="hidden xl:block w-56 shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto print:hidden">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2 px-2">
          Inhalt
        </p>
        <TocNav entries={TOC} />
      </aside>

      {/* Content */}
      <article className="min-w-0 max-w-3xl flex-1 pb-20">
        {/* Page title + print button */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl font-bold">Benutzerhandbuch</h1>
          <PrintButton />
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          420er-Ranglisten­verwaltung · DSV-Ranglistenordnung gültig ab 01.01.2026
        </p>

        <PrintToc />

        {/* ── Übersicht ──────────────────────────────────────────────────────── */}
        <H1 id="uebersicht">Übersicht</H1>
        <P>
          Diese Anwendung verwaltet Regatten, Segler und Ergebnisse der 420er-Klasse und berechnet
          daraus die DSV-Rangliste. Die wichtigsten Arbeitsschritte sind:
        </P>

        <WorkflowDiagram />

        <Ul>
          <Li><strong>Regatten anlegen</strong> – Stammdaten, Ranglistenfaktor, Quelle (Manage2Sail-URL)</Li>
          <Li><strong>Ergebnisse importieren</strong> – aus Manage2Sail per Web-Copy-Paste oder PDF-Upload</Li>
          <Li><strong>Segler zuordnen</strong> – Fuzzy-Matching schlägt bekannte Segler vor, neue werden angelegt</Li>
          <Li><strong>Rangliste erstellen</strong> – Jahresrangliste, Aktuelle Rangliste oder IDJM-Quali</Li>
        </Ul>
        <Hint>
          Die öffentliche Ansicht unter <Code>/rangliste</Code>, <Code>/regatten</Code> und{" "}
          <Code>/regatta/[id]</Code> ist ohne Login zugänglich und zeigt alle veröffentlichten
          Ranglisten mit vollständiger Berechnungs­transparenz.
        </Hint>

        {/* ── Segler ─────────────────────────────────────────────────────────── */}
        <H1 id="segler">Segler verwalten</H1>

        <H2 id="segler-anlegen">Segler anlegen</H2>
        <P>
          Unter <strong>Segler → Neu</strong> kannst du einen Segler manuell anlegen. Beim Import
          werden neue Segler automatisch vorgeschlagen; du bestätigst nur noch die Anlage.
          Segler ohne Geburtsjahr oder Geschlecht erscheinen in gefilterten Ranglisten
          (Altersklassen, Gender) nicht, sind aber in der Open-Kategorie vollständig enthalten.
        </P>

        <H2 id="segler-stammdaten">Stammdaten & Felder</H2>
        <Ul>
          <Li><strong>Vorname / Nachname</strong> – Pflichtfelder; werden beim Import per Fuzzy-Matching gesucht.</Li>
          <Li><strong>Geburtsjahr</strong> – Basis für Altersklassen-Zuordnung (U15–U19). Stichtag ist der 31.12. des Saison­jahres.</Li>
          <Li><strong>Geschlecht</strong> – M / F; erforderlich für Gender-gefilterte Ranglisten (Männer, Mix, Girls).</Li>
          <Li><strong>Verein</strong> – Wird beim Import aus den Manage2Sail-Daten übernommen, sofern noch nicht gesetzt.</Li>
          <Li><strong>Segelnummer</strong> – Optionale Lizenznummer; verbessert das Fuzzy-Matching (+0,05 Bonus).</Li>
          <Li><strong>Staatsangehörigkeit</strong> – Standard: GER. Ausländische Segler können importiert werden, fließen aber nur mit deutschen Booten in die Rangliste ein.</Li>
        </Ul>

        <H2 id="segler-altnamen">Alternative Namen</H2>
        <P>
          Jeder Segler kann beliebig viele alternative Schreibweisen seines Namens speichern
          (z.&thinsp;B. <Code>Müller</Code> ↔ <Code>Mueller</Code> ↔ <Code>Muller</Code>).
          Alternative Namen werden beim Fuzzy-Matching wie der Hauptname behandelt und verhindert,
          dass derselbe Segler doppelt angelegt wird.
        </P>
        <P>
          Beim Import kann der Admin direkt im Matching-Schritt wählen:
          <em> „Als alternativen Namen speichern"</em> – die neue Schreibweise wird sofort
          dem gefundenen Segler hinzugefügt.
        </P>

        {/* ── Regatten ───────────────────────────────────────────────────────── */}
        <H1 id="regatten">Regatten verwalten</H1>

        <H2 id="regatten-anlegen">Regatta anlegen</H2>
        <P>
          Über <strong>Regatten → Neue Regatta</strong> legst du eine Regatta mit allen
          Stammdaten an. Pflichtfelder sind Name, Start- und Enddatum, Ranglistenfaktor und die
          Anzahl der abgeschlossenen Wettfahrten. Optional kannst du die Manage2Sail-URL
          hinterlegen – sie ermöglicht den automatischen M2S-Abgleich und den direkten Import­link.
        </P>

        <H2 id="regatten-felder">Felder & Faktor</H2>
        <Ul>
          <Li><strong>Ranglistenfaktor f</strong> – 0,80 bis 2,60 gemäß DSV-RO. Wird von der 420er-KV festgelegt. Höherer Faktor = mehr Gewicht in der Rangliste.</Li>
          <Li><strong>Abgeschlossene Wettfahrten</strong> – Anzahl der gewerteten Wettfahrten; bestimmt den Multiplikator m.</Li>
          <Li><strong>Mehrtages-Ausschreibung</strong> – Aktivieren, wenn die Regatta offiziell als mehrtägig ausgeschrieben ist (relevant für m = 5 bei ≥ 6 Wettfahrten).</Li>
          <Li><strong>Ranglistenregatta</strong> – Nur als solche gekennzeichnete Regatten fließen in DSV-Ranglisten ein.</Li>
          <Li><strong>Manage2Sail-URL</strong> – URL der Klassen-Ergebnisseite (<Code>manage2sail.com/…#!/results?classId=…</Code>). Wird für den M2S-Abgleich und den Import­direktlink benötigt.</Li>
        </Ul>

        <H2 id="regatten-m2s">M2S-Abgleich</H2>
        <P>
          Der Button <strong>„M2S abgleichen"</strong> in der Regatten-Liste ruft für das
          gewählte Jahr die Manage2Sail-Klassenübersicht ab und vergleicht die dort gespeicherte
          Wettfahrtenanzahl mit dem lokalen Wert. Abweichungen werden in der Tabelle markiert
          (alte Zahl durchgestrichen, neue Zahl fett) und ein oranger{" "}
          <strong>„Ergebnisse importieren"</strong>-Button erscheint direkt in der Zeile.
        </P>
        <Hint>
          Der Abgleich funktioniert nur für Regatten, bei denen eine Manage2Sail-URL hinterlegt ist.
        </Hint>

        {/* ── Import ─────────────────────────────────────────────────────────── */}
        <H1 id="import">Ergebnisse importieren</H1>
        <P>
          Den Import-Wizard erreichst du über den orangenen <strong>„Ergebnisse importieren"</strong>-Button
          in der Regatten-Liste oder über die Detailseite einer Regatta. Der Wizard führt dich
          in vier Schritten durch den Import:
        </P>

        <ImportWizardSteps />

        <H2 id="import-quelle">Importquellen</H2>
        <Ul>
          <Li>
            <strong>Manage2Sail Web-Copy-Paste (primär)</strong> – Öffne die Ergebnisseite der
            gewünschten Klasse auf manage2sail.com, markiere die gesamte Ergebnistabelle
            (Strg+A oder manuell), kopiere sie (Strg+C) und füge den Text im ersten Wizard-Schritt ein.
            Enthält Steuermann, Vorschoter, Segelnummer, Verein und alle Race-Scores.
          </Li>
          <Li>
            <strong>Manage2Sail URL</strong> – Füge direkt die URL der Ergebnisseite ein
            (<Code>manage2sail.com/de-DE/event/…#!/results?classId=…</Code>).
            Die App ruft die Daten automatisch ab.
          </Li>
          <Li>
            <strong>PDF-Upload (Fallback)</strong> – Lade das „Overall Results"-PDF von
            Manage2Sail hoch. Enthält nur den Steuermann; der Vorschoter muss im Anschluss
            manuell nachgepflegt werden.
          </Li>
        </Ul>

        <H2 id="import-matching">Fuzzy-Matching</H2>
        <P>
          Im Matching-Schritt vergleicht die App jeden Namen aus den Ergebnissen mit allen
          bekannten Seglern. Die Übereinstimmung wird farblich dargestellt:
        </P>

        <FuzzyThresholdBar />

        <P>
          Die Normalisierung umfasst: Kleinschreibung, Umlaut-Umschreibung (ä→ae, ö→oe, ü→ue,
          ß→ss), Bindestriche und Unterstriche → Leerzeichen sowie das Erkennen vertauschter
          Vor-/Nachname-Reihenfolge. Eine vorhandene Segelnummer gibt einen Bonus von +0,05 auf die
          Ähnlichkeit.
        </P>
        <Warn>
          Segler werden <strong>nie automatisch</strong> zugeordnet oder angelegt – jede
          Entscheidung erfordert eine explizite Bestätigung durch den Admin.
        </Warn>

        <H2 id="import-startarea">Startgebiet</H2>
        <P>
          Boote, die ins Startgebiet gekommen sind, aber keine Wettfahrt beendet haben
          (Code DNS, BFD, OCS), bekommen <strong>R_A = 0</strong>, zählen aber in der
          Gesamtstarteranzahl <em>s</em> mit und gehen m-fach als Wertung 0 in die
          Werteliste ein. Im Vorschau-Schritt wird das Häkchen ✓ in der Spalte „Startgeb."
          angezeigt.
        </P>
        <P>
          Tipp: Manage2Sail kennzeichnet solche Einträge mit den oben genannten Codes in den
          Race-Spalten. Der Parser erkennt sie automatisch und setzt den Vorschlag für
          <Code>inStartArea</Code> entsprechend.
        </P>

        {/* ── Ranglisten ─────────────────────────────────────────────────────── */}
        <H1 id="ranglisten">Ranglisten</H1>

        <H2 id="ranglisten-typen">Typen & Kategorien</H2>
        <Ul>
          <Li>
            <strong>Jahresrangliste</strong> – Stichtag 30.11., alle Ranglistenregatten des
            Kalenderjahres. Wird als unveränderlicher Snapshot gespeichert.
          </Li>
          <Li>
            <strong>Aktuelle Rangliste</strong> – Immer on-demand berechnet (kein Snapshot),
            üblicherweise 14 Tage vor einem Meldeschluss abgerufen.
          </Li>
          <Li>
            <strong>IDJM-Quali</strong> – Gefilterte aktuelle Rangliste: nur U19 und U16,
            nur Boote mit R ≥ 25. Referenzdatum für das Alter ist der jeweilige Regatta-Start.
          </Li>
        </Ul>
        <P>
          Altersklassen: <Code>U15</Code> (max. 14 Jahre), <Code>U16</Code> (max. 15),{" "}
          <Code>U17</Code> (max. 16), <Code>U19</Code> (max. 18), <Code>Open</Code> (alle).
          Stichtag ist jeweils der 31.12. des Saison­jahres. Fehlt bei einem der beiden
          Mannschafts­mitglieder Geburtsjahr oder Geschlecht, erscheint das Boot in
          gefilterten Kategorien nicht.
        </P>

        <H2 id="ranglisten-formel">DSV-Formel (RO Anlage 1 §2, gültig ab 01.01.2026)</H2>

        <FormulaBreakdown />

        <P>
          Die <strong>Ranglistenpunktzahl R</strong> ist das arithmetische Mittel der
          9 besten R_A-Werte aus allen Wertungen der Saison. Boote mit weniger als 9 Wertungen
          erscheinen nicht in der Rangliste.
        </P>
        <P>
          Der <strong>Multiplikator m</strong> bestimmt, wie oft eine Regatta in die Werteliste eingeht.
          Damit können mehrtägige Regatten stärker gewichtet werden:
        </P>

        <MultiplierTable />

        <Hint>
          Ein Boot mit 2 Wettfahrten bei einer Regatta (m = 2) geht zweimal mit demselben
          R_A-Wert in die Werteliste ein. Die Rangliste nimmt daraus die 9 besten.
        </Hint>

        <H2 id="ranglisten-tiebreak">Tiebreak</H2>
        <P>Bei gleichem R wird nach folgenden Kriterien aufgelöst:</P>
        <Ul>
          <Li>Stufe 1: Höchster einzelner R_A-Wert unter den 9 einfließenden Wertungen</Li>
          <Li>Stufe 2: Anzahl der einfließenden Wertungen (mehr = besser)</Li>
        </Ul>

        <H2 id="ranglisten-idjm">IDJM-Quali</H2>
        <P>
          Der IDJM-Quali-Filter verwendet für die Alters­prüfung <strong>den Start­termin
          der jeweiligen Regatta</strong> als Referenz­datum – nicht den 31.12. der Saison.
          Ein Boot, dessen Vorschoter bei einer frühen Regatta noch unter 19 war, bei einer
          späteren aber 19 wurde, verliert die spätere Wertung im IDJM-Filter (erscheint
          aber weiterhin in der Jahres­rangliste).
        </P>
        <P>
          Mindest-R für die IDJM-Quali-Liste: <strong>25 Punkte</strong>.
        </P>

        {/* ── Wartung ────────────────────────────────────────────────────────── */}
        <H1 id="wartung">Wartung</H1>

        <H2 id="wartung-backup">Datensicherung</H2>
        <P>
          Unter <strong>Wartung</strong> kannst du automatische Backups einrichten. Konfigurierbar
          sind Uhrzeit, Wochentag(e), Anzahl der aufzuhebenden Dateien (Standard: 30) und ein
          optionales Verschlüsselungs­passwort.
        </P>
        <Ul>
          <Li><strong>Automatisch</strong> – Der Server führt das Backup gemäß Zeitplan aus (node-cron). Die Konfiguration bleibt auch nach einem Server­neustart erhalten.</Li>
          <Li><strong>Manuell</strong> – „Jetzt sichern" erstellt sofort ein Backup und fügt es der Liste hinzu.</Li>
          <Li><strong>Download</strong> – Jede gespeicherte Datei kann heruntergeladen werden.</Li>
          <Li><strong>Verschlüsselung</strong> – AES-256-GCM mit scrypt-Schlüsselableitung. Das Passwort wird im Klartext in <Code>data/backups/_schedule.json</Code> gespeichert. Notiere es separat – verschlüsselte Backups können ohne Passwort nicht wiederhergestellt werden.</Li>
        </Ul>
        <Warn>
          Backupdateien enthalten alle Segler- und Ergebnisdaten, aber keine Admin-Passwörter.
          Verschlüsselte Backups sind auch ohne Serverzugang nur mit dem Passwort lesbar.
        </Warn>

        <H2 id="wartung-restore">Rücksicherung</H2>
        <P>
          Lade eine zuvor gespeicherte JSON-Backup-Datei hoch. Ist die Datei verschlüsselt,
          erscheint automatisch ein Passwort-Feld. Alle vorhandenen Daten werden vor der
          Rücksicherung gelöscht und durch die Backup-Daten ersetzt. Admin-Accounts bleiben
          dabei immer erhalten.
        </P>
        <Warn>
          Die Rücksicherung löscht zunächst alle Daten und schreibt dann den Backup-Stand ein.
          Stelle sicher, dass du die richtige Datei ausgewählt hast.
        </Warn>

        <H2 id="wartung-pruning">Datenreduktion</H2>
        <P>
          Löscht alle Regatten (incl. Ergebnisse, Import-Sessions und Ranglisten-Verknüpfungen)
          vor einem bestimmten Jahr. Anschließend werden alle Segler ohne verbleibende Einträge
          automatisch entfernt.
        </P>
        <P>
          Die Option <strong>„Vor dem Löschen Backup durchführen"</strong> ist standardmäßig aktiv
          und erstellt unmittelbar vor der Löschung ein serverseitiges Backup.
        </P>
      </article>
    </div>
  );
}
