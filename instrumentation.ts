export async function register() {
  // Only run in Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // ── DOMMatrix polyfill for pdfjs-dist ────────────────────────────────────
    // pdfjs-dist v5+ references `DOMMatrix` at module initialisation time
    // (top-level `const SCALE_MATRIX = new DOMMatrix()`). Node.js does not
    // provide DOMMatrix, so the import would throw
    // "ReferenceError: DOMMatrix is not defined" before any actual PDF
    // parsing can occur.  We install a minimal stub that satisfies the
    // module-level initialisation; the full rendering path (canvas ops) is
    // never taken during server-side text extraction.
    if (typeof globalThis.DOMMatrix === "undefined") {
      type Arr6 = [number, number, number, number, number, number];
      class DOMMatrixPolyfill {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        m11 = 1; m12 = 0; m13 = 0; m14 = 0;
        m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0;
        m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        is2D = true;
        isIdentity = true;
        constructor(init?: string | number[]) {
          if (Array.isArray(init) && init.length === 6) {
            const [a, b, c, d, e, f] = init as Arr6;
            this.a = a; this.b = b; this.c = c;
            this.d = d; this.e = e; this.f = f;
            this.m11 = a; this.m12 = b;
            this.m21 = c; this.m22 = d;
            this.m41 = e; this.m42 = f;
          }
        }
        // Return a new identity-like instance for all matrix operations.
        // These are only invoked during canvas rendering, not text extraction.
        private _new() { return new DOMMatrixPolyfill(); }
        multiply        ()    { return this._new(); }
        inverse         ()    { return this._new(); }
        invertSelf      ()    { return this; }
        multiplySelf    ()    { return this; }
        preMultiplySelf ()    { return this; }
        translate       ()    { return this._new(); }
        translateSelf   ()    { return this; }
        scale           ()    { return this._new(); }
        scaleSelf       ()    { return this; }
        scale3d         ()    { return this._new(); }
        scale3dSelf     ()    { return this; }
        rotate          ()    { return this._new(); }
        rotateSelf      ()    { return this; }
        rotateFromVector()    { return this._new(); }
        rotateAxisAngle ()    { return this._new(); }
        skewX           ()    { return this._new(); }
        skewXSelf       ()    { return this; }
        skewY           ()    { return this._new(); }
        skewYSelf       ()    { return this; }
        flipX           ()    { return this._new(); }
        flipY           ()    { return this._new(); }
        transformPoint(p?: { x?: number; y?: number }) {
          return { x: p?.x ?? 0, y: p?.y ?? 0, z: 0, w: 1 };
        }
        toFloat32Array() { return new Float32Array([this.a,this.b,this.c,this.d,this.e,this.f]); }
        toFloat64Array() { return new Float64Array([this.a,this.b,this.c,this.d,this.e,this.f]); }
        toString()       { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`; }
        static fromMatrix(m?: Partial<DOMMatrixPolyfill>) {
          const r = new DOMMatrixPolyfill();
          if (m) Object.assign(r, m);
          return r;
        }
        static fromFloat32Array(a: Float32Array) { return new DOMMatrixPolyfill(Array.from(a)); }
        static fromFloat64Array(a: Float64Array) { return new DOMMatrixPolyfill(Array.from(a)); }
      }
      // Cast to `unknown` first to avoid TS structural mismatch with the full
      // built-in DOMMatrix interface (which has many additional members we
      // don't need to implement for text extraction).
      (globalThis as unknown as Record<string, unknown>).DOMMatrix = DOMMatrixPolyfill;
    }

    const { initBackupScheduler } = await import("./lib/backup/scheduler");
    await initBackupScheduler();
  }
}
