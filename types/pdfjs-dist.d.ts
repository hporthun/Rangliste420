/**
 * Type stub for pdfjs-dist's worker entry-point.
 *
 * pdfjs-dist v5 ships a `.mjs` worker file but no matching `.d.ts`. We import
 * it dynamically in lib/import/pdf-utils.ts to pre-load the
 * WorkerMessageHandler into globalThis.pdfjsWorker (so pdfjs-dist's internal
 * fake-worker setup skips its `import(workerSrc)` call). TypeScript's strict
 * mode trips during the Vercel build without this declaration.
 *
 * The shape we expose is intentionally minimal — we only need the
 * WorkerMessageHandler symbol to assign it to globalThis. The internal
 * implementation type is opaque to us.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
