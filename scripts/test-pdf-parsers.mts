// Quick smoke-test for the three new PDF parsers.
// Run: npx tsx scripts/test-pdf-parsers.mts
import { readFile } from "fs/promises";
import { resolve } from "path";
import { pathToFileURL } from "url";

// Set worker src before any pdfjs import
const { GlobalWorkerOptions } = await import(
  "../node_modules/pdfjs-dist/legacy/build/pdf.mjs"
);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve("./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

// Now import our parsers (they use dynamic import for pdfjs internally)
const { parsePdf } = await import("../lib/import/pdf-auto-detect");

const files = [
  {
    path: "C:/Users/hporthun/Downloads/Imperia Winterregatta.pdf",
    expected: "velaware",
  },
  {
    path: "C:/Users/hporthun/Downloads/carnival Race 2026420_Results_DAY 4.pdf",
    expected: "sailresults",
  },
  {
    path: "C:/Users/hporthun/Downloads/20260411142843_sailwave-results-for-lupo-cup-at-circolo-vela-torbole-2026-rev3.pdf",
    expected: "sailwave",
  },
];

for (const { path, expected } of files) {
  const name = path.split("/").pop();
  console.log(`\n===== ${name} =====`);
  console.log(`Expected format: ${expected}`);
  try {
    const buf = await readFile(path);
    const { format, result } = await parsePdf(buf.buffer);
    const ok = format === expected ? "✓" : "✗";
    console.log(`Format detected: ${format} ${ok}`);
    console.log(`Entries: ${result.entries.length}, Races: ${result.numRaces}`);

    if (result.entries.length > 0) {
      const e = result.entries[0];
      const scores = e.raceScores
        .map(
          (s) =>
            `${s.isDiscard ? "(" : ""}${s.points}${s.code ? "/" + s.code : ""}${s.isDiscard ? ")" : ""}`
        )
        .join(" ");
      console.log(
        `  #${e.rank}: ${e.helmFirstName} ${e.helmLastName} / ` +
          `${e.crewFirstName ?? "-"} ${e.crewLastName ?? "-"} | ` +
          `${e.club ?? "?"} | net=${e.netPoints}`
      );
      console.log(`  Scores: ${scores}`);
    }
    const last = result.entries[result.entries.length - 1];
    if (last && result.entries.length > 1) {
      console.log(
        `  ...#${last.rank}: ${last.helmFirstName} ${last.helmLastName}`
      );
    }
  } catch (e) {
    if (e instanceof Error) {
      console.log("ERROR:", e.message);
      console.log(e.stack?.split("\n").slice(0, 5).join("\n"));
    }
  }
}
