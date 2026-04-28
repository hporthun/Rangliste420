#!/usr/bin/env node
/**
 * Sync the production Prisma schema (PostgreSQL) from the local SQLite schema.
 *
 * Why: Prisma allows only a single `provider` per schema, so we keep two
 * schemas — one for SQLite (local dev) and one for PostgreSQL (Vercel).
 * The model definitions must stay in lock-step. This script copies models
 * 1:1 and only swaps the datasource + leading comment block.
 *
 * Run: node scripts/sync-prod-schema.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "prisma", "schema.prisma");
const DST = resolve(HERE, "..", "prisma", "prod", "schema.prisma");

const PROD_HEADER = `// Produktions-Schema für Vercel + Neon PostgreSQL.
// AUTO-GENERIERT aus prisma/schema.prisma — NICHT manuell editieren.
// Re-generieren mit: npm run db:sync-prod
//
// Lokal wird prisma/schema.prisma (SQLite) verwendet.
// Vercel-Build:  prisma migrate deploy --schema=prisma/prod/schema.prisma
//             && prisma generate     --schema=prisma/prod/schema.prisma
//             && next build
`;

const PROD_DATASOURCE = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  // Pooled connection (PgBouncer) — used by the application at runtime.
  // For Neon the pooled URL ends with \`-pooler.<region>.neon.tech\`.
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Direct (non-pooled) connection — required by Prisma Migrate.
  // Falls back to DATABASE_URL when DATABASE_URL_UNPOOLED is unset.
  directUrl = env("DATABASE_URL_UNPOOLED")
}
`;

const src = readFileSync(SRC, "utf-8");

// Split off the leading "generator { ... } datasource { ... }" block by
// finding the first model/enum/view declaration. Everything before it is
// the SQLite-specific header that we replace.
const firstDeclMatch = src.match(/^\s*(model|enum|view|type)\s+/m);
if (!firstDeclMatch) {
  console.error("Could not find a model/enum/view declaration in schema.prisma");
  process.exit(1);
}
const modelsAndBeyond = src.slice(firstDeclMatch.index).trimStart();

const out = `${PROD_HEADER}\n${PROD_DATASOURCE}\n${modelsAndBeyond}`;
writeFileSync(DST, out);

console.log(`Synced ${SRC} → ${DST} (${out.length} chars)`);
