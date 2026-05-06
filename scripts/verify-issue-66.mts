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
  const helm = `${rank99.helmFirstName} ${rank99.helmLastName}`.trim();
  const crew = `${rank99.crewFirstName ?? ""} ${rank99.crewLastName ?? ""}`.trim();
  console.log(`\nRank 99: helm="${helm}", crew="${crew}"`);
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

// 6) Alle Mojibake-Items im Raw-Output → Helper anwenden, Resultate sammeln
console.log(`\n--- ALLE Mojibake-Items im Raw-Output ---`);
const allMoj = rawAll.filter((s) => /[ÃÅÂƒ]/.test(s));
console.log(`Anzahl Mojibake-Items roh: ${allMoj.length}`);
const repaired = new Map<string, string>();
let unrepaired = 0;
for (const s of allMoj) {
  const fixed = fixDoubleEncodedUtf8(s);
  if (fixed === s) {
    unrepaired++;
    console.log(`  NICHT REPARIERT: "${s}"`);
  } else {
    repaired.set(s, fixed);
  }
}
console.log(`Repariert: ${repaired.size}, NICHT repariert: ${unrepaired}`);
console.log(`\nUnique Reparaturen:`);
for (const [k, v] of repaired) console.log(`  "${k}" → "${v}"`);

// 7) Vollstaendigkeit: jeder Eintrag mit Helm + Crew + Club?
console.log(`\n--- Vollstaendigkeit aller ${result.entries.length} Entries ---`);
const incomplete = result.entries.filter(
  (e) => !e.helmLastName || !e.club || e.rank === null,
);
console.log(`Unvollstaendige Entries: ${incomplete.length}`);
incomplete.slice(0, 10).forEach((e) =>
  console.log(`  Rank ${e.rank}: helm="${e.helmFirstName} ${e.helmLastName}".trim(), club="${e.club}", sail="${e.sailNumber}"`),
);

// 8) Alle Helm/Crew-Namen mit Sonderzeichen pruefen
console.log(`\n--- Helm/Crew-Namen mit Sonderzeichen ---`);
const specialNames: string[] = [];
for (const e of result.entries) {
  const helm = `${e.helmFirstName} ${e.helmLastName}`.trim();
  const crew = `${e.crewFirstName ?? ""} ${e.crewLastName ?? ""}`.trim();
  if (/[äöüÄÖÜßéèêíóúñžšćčáàÀÉőűŐŰÚÁÍÓ]/.test(helm)) {
    specialNames.push(`Rank ${e.rank} helm: "${helm}"`);
  }
  if (/[äöüÄÖÜßéèêíóúñžšćčáàÀÉőűŐŰÚÁÍÓ]/.test(crew)) {
    specialNames.push(`Rank ${e.rank} crew: "${crew}"`);
  }
}
specialNames.forEach((s) => console.log(`  ${s}`));
if (!specialNames.length) console.log("(keine)");

// 9) Top-10-Sample (Sanity)
console.log(`\n--- Top 10 (Sanity) ---`);
result.entries.slice(0, 10).forEach((e) => {
  const helm = `${e.helmFirstName} ${e.helmLastName}`.trim();
  console.log(`  ${e.rank}. ${helm} | ${e.sailNumber} | ${e.club}`);
});

// 10) Kanonische Issue-#66-Beispiele 1:1 nachweisen
console.log(`\n--- Kanonische Issue-#66-Beispiele ---`);
const cases: Array<[string, string]> = [
  ["GrÃ¼nau", "Grünau"],
  ["PortoroÅ¾", "Portorož"],
  ["TÃ³th", "Tóth"],
  ["JÃºlia", "Júlia"],
  ["CsermÃ¡k", "Csermák"],
];
for (const [moji, expected] of cases) {
  const got = fixDoubleEncodedUtf8(moji);
  console.log(`  ${got === expected ? "OK" : "FAIL"} "${moji}" → "${got}" (erwartet "${expected}")`);
}

// Exit-Code: 0 wenn Fix wirkt, 1 sonst
const success =
  fixedHasGruenau &&
  !fixedHasMojibake &&
  unrepaired === 0 &&
  incomplete.length === 0;
console.log(`\n${success ? "PASS" : "FAIL"}: Mojibake-Fix wirkt im Live-Pfad: ${success}`);
process.exit(success ? 0 : 1);
