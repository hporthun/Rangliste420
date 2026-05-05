-- RateLimitEntry: persistenter Sliding-Window-Counter (Issue #59).
-- Loest die In-Memory-Map ab, die unter Vercel-Serverless durch Cold-
-- Starts und parallele Lambda-Instanzen mehrfach gehalten wurde.
-- Dev-Pendant: 20260505132808_add_rate_limit_entry.

CREATE TABLE IF NOT EXISTS "RateLimitEntry" (
    "key"        TEXT NOT NULL PRIMARY KEY,
    "timestamps" TEXT NOT NULL,
    "updatedAt"  TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "RateLimitEntry_updatedAt_idx"
    ON "RateLimitEntry" ("updatedAt");
