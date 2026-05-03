-- Sailor.member420: Mitglied der 420er-KV — Pflicht für JWM/JEM-Quali.
-- Dev-Pendant: 20260430190439_add_member420. Default true, damit bestehende
-- Datensaetze nicht ploetzlich aus der Quali fallen.

ALTER TABLE "Sailor"
  ADD COLUMN IF NOT EXISTS "member420" BOOLEAN NOT NULL DEFAULT true;
