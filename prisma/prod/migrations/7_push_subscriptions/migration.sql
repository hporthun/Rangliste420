-- Web-Push-Abos und Singleton-State für die Versions-Broadcast-Logik
-- (Dev-Pendant: 20260430102459_push_subscriptions). Nachgereicht als 7,
-- weil 5/6 auf Prod bereits ausgeführt sind; Tabellen sind unabhängig.

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        TEXT        NOT NULL PRIMARY KEY,
  "endpoint"  TEXT        NOT NULL,
  "p256dh"    TEXT        NOT NULL,
  "auth"      TEXT        NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
  ON "PushSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_createdAt_idx"
  ON "PushSubscription"("createdAt");

CREATE TABLE IF NOT EXISTS "PushBroadcastState" (
  "id"                INTEGER      NOT NULL PRIMARY KEY DEFAULT 1,
  "lastPushedVersion" TEXT,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);
