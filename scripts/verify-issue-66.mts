// Real-PDF-Verifikation fuer Issue #66.
// Run: npx tsx scripts/verify-issue-66.mts
import { readFile } from "fs/promises";
import { resolve } from "path";
import { pathToFileURL } from "url";

const { GlobalWorkerOptions } = await import(
  "../node_modules/pdfjs-dist/legacy/build/pdf.mjs"
);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve("./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const { extractPageItems, fixDoubleEncodedUtf8 } = await import(
  "../lib/import/pdf-utils"
);
const { parsePages } = await import("../lib/import/velaware-en-pdf");

const path = "C:/Users/hporthun/Downloads/20250425161739_results-after-10-races-and-protest.pdf";
const bufA = await readFile(path);
const bufB = await readFile(path);

console.log(`File: ${path.split("/").pop()}`);
console.log(`Size: ${(bufA.byteLength / 1024).toFixed(1)} KB\n`);

// 1) Raw pdfjs output WITHOUT fix (simuliere alten Stand) — direkter Aufruf
const pdfjs = await import("../node_modules/pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(bufA.buffer, bufA.byteOffset, bufA.byteLength);
const doc = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise;
const rawAll: string[] = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  for (const item of tc.items) {
    if ("str" in item && item.str.trim()) rawAll.push(item.str.trim());
  }
}
const rawJoined = rawAll.join(" | ");
const rawHasMojibake = /[ÃÅÂƒ]/.test(rawJoined);
const rawHasGruenauFix = rawJoined.includes("Grünau");
const rawHasMojibakeGruenau = rawJoined.includes("GrÃ¼nau");

console.log("--- Raw pdfjs (vor Fix) ---");
console.log(`Mojibake-Marker (Ã/Å/Â/ƒ) im Output: ${rawHasMojibake ? "JA" : "nein"}`);
console.log(`Enthaelt 'Grünau' (sauber): ${rawHasGruenauFix}`);
console.log(`Enthaelt 'GrÃ¼nau' (Mojibake): ${rawHasMojibakeGruenau}`);

// 2) Mit Fix (Live-Pfad) — frischer Buffer, weil pdfjs den ersten detached
const data2 = new Uint8Array(bufB.buffer, bufB.byteOffset, bufB.byteLength);
const pages = await extractPageItems(data2);
const fixedAll = pages.flat().map((it) => it.str).join(" | ");
const fixedHasMojibake = /[ÃÅÂƒ]/.test(fixedAll);
const fixedHasGruenau = fixedAll.includes("Grünau");

console.log("\n--- Mit Fix (extractPageItems) ---");
console.log(`Mojibake-Marker im Output: ${fixedHasMojibake ? "JA" : "nein"}`);
console.log(`Enthaelt 'Grünau': ${fixedHasGruenau}`);

// 3) Parse durchlaufen
const result = parsePages(pages);
console.log(`\n--- Parser-Resultat ---`);
console.log(`Entries: ${result.entries.length}, Races: ${result.numRaces}`);

// 4) Suche nach Rank 99 (Grünau-Eintrag laut Issue)
const rank99 = result.entries.find((e) => e.rank === 99);
if (rank99) {
  console.log(`\nRank 99: helm="${rank99.helm}", crew="${rank99.crew}"`);
  console.log(`         club="${rank99.club}"`);
  console.log(`         sailNumber="${rank99.sailNumber}"`);
}

// 5) Alle Clubs mit Sonderzeichen ausgeben
console.log(`\n--- Clubs mit Sonderzeichen (post-Fix) ---`);
const specialClubs = result.entries
  .filter((e) => /[äöüÄÖÜßéèêíóúñžšćčáàÀÉ]/.test(e.club ?? ""))
  .map((e) => `Rank ${e.rank}: "${e.club}"`);
if (specialClubs.length === 0) console.log("(keine)");
else specialClubs.forEach((s) => console.log(s));

// 6) Sample-Helper-Test direkt am Raw-Output
console.log(`\n--- Sample-Items aus rawer Pipeline (vor Helper) ---`);
const moj = rawAll.filter((s) => /[ÃÅÂƒ]/.test(s)).slice(0, 5);
moj.forEach((s) => {
  const fixed = fixDoubleEncodedUtf8(s);
  console.log(`  "${s}" → "${fixed}"`);
});

// Exit-Code: 0 wenn Fix wirkt, 1 sonst
const success = fixedHasGruenau && !fixedHasMojibake;
console.log(`\n${success ? "PASS" : "FAIL"}: Mojibake-Fix wirkt im Live-Pfad: ${success}`);
process.exit(success ? 0 : 1);
