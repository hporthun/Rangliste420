// Quick smoke-test for the three new PDF parsers.
// Run: node scripts/test-pdf-parsers.mjs
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

// Need to set worker src for pdfjs
const pdfjsLegacy = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs');
pdfjsLegacy.GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

// Dynamically import the parsers (they use dynamic import internally but that's ok in ESM)
// We'll use the dispatcher
const { parsePdf } = await import('../lib/import/pdf-auto-detect.ts').catch(() =>
  // Try compiled version if ts not found
  import('../.next/server/chunks/lib/import/pdf-auto-detect.js').catch(() => {
    throw new Error('Compile the project first: npx tsc');
  })
);

const files = [
  { path: 'C:/Users/hporthun/Downloads/Imperia Winterregatta.pdf', expected: 'velaware' },
  { path: 'C:/Users/hporthun/Downloads/carnival Race 2026420_Results_DAY 4.pdf', expected: 'sailresults' },
  { path: 'C:/Users/hporthun/Downloads/20260411142843_sailwave-results-for-lupo-cup-at-circolo-vela-torbole-2026-rev3.pdf', expected: 'sailwave' },
];

for (const { path, expected } of files) {
  const name = path.split('/').pop();
  console.log(`\n===== ${name} (expected: ${expected}) =====`);
  try {
    const buf = await readFile(path);
    const { format, result } = await parsePdf(buf.buffer);
    console.log(`Format detected: ${format}`);
    console.log(`Entries: ${result.entries.length}, Races: ${result.numRaces}`);
    if (result.entries.length > 0) {
      const e = result.entries[0];
      console.log(`First entry: rank=${e.rank} sail=${e.sailNumber} helm="${e.helmFirstName} ${e.helmLastName}" crew="${e.crewFirstName} ${e.crewLastName}" club="${e.club}"`);
      console.log(`  scores: ${e.raceScores.map(s => `${s.isDiscard?'(':''}${s.points}${s.code?'/'+s.code:''}${s.isDiscard?')':''}`).join(' ')}`);
    }
    const last = result.entries[result.entries.length - 1];
    if (last && result.entries.length > 1) {
      console.log(`Last entry: rank=${last.rank} helm="${last.helmFirstName} ${last.helmLastName}"`);
    }
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log(e.stack?.split('\n').slice(0,5).join('\n'));
  }
}
