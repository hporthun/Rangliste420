import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy
// In dev: allow 'unsafe-eval' and 'unsafe-inline' for Turbopack hot-reload
const csp = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src blob:",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // Prevent embedding in iframes (clickjacking)
  { key: "X-Frame-Options",        value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control referrer information
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  // Restrict browser features
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // CSP
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS (production only)
  ...(isDev ? [] : [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ]),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],

  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },

    // pdfjs-dist imports pdf.worker.mjs dynamically with `/* webpackIgnore */`,
    // so webpack and Vercel's nft file tracer both skip it. We include it
    // explicitly so the file exists on the serverless function's file system.
    outputFileTracingIncludes: {
      "/**": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
    },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
