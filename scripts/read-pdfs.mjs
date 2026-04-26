import { getDocument, GlobalWorkerOptions } from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

async function extractText(filePath) {
  const url = pathToFileURL(filePath).href;
  const doc = await getDocument({ url, useWorkerFetch: false, isEvalSupported: false }).promise;
  let out = `(${doc.numPages} Seiten)\n`;
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let lastY = null, row = [];
    const rows = [];
    for (const item of tc.items) {
      if (!('str' in item)) continue;
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 3) {
        if (row.length) rows.push(row.join(' | '));
        row = [];
      }
      if (item.str.trim()) row.push(item.str.trim());
      lastY = item.transform[5];
    }
    if (row.length) rows.push(row.join(' | '));
    out += `\n-- Seite ${i} --\n` + rows.slice(0, 100).join('\n');
  }
  return out;
}

const files = [
  'C:/Users/hporthun/Downloads/Imperia Winterregatta.pdf',
  'C:/Users/hporthun/Downloads/carnival Race 2026420_Results_DAY 4.pdf',
  'C:/Users/hporthun/Downloads/20260411142843_sailwave-results-for-lupo-cup-at-circolo-vela-torbole-2026-rev3.pdf',
];

for (const f of files) {
  console.log('\n===== ' + f.split('/').pop() + ' =====');
  try { console.log(await extractText(f)); }
  catch(e) { console.log('FEHLER:', e.message); }
}
