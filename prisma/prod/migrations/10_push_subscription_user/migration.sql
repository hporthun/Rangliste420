-- PushSubscription.userId: nullable Verknuepfung zu User. Update-Push-
-- Notifications werden nur an Subscriptions mit userId IS NOT NULL geschickt
-- (also nur an angemeldete Admins/Editors). Anonyme Public-Subscriptions
-- (userId NULL) bekommen weiterhin Inhalts-Pushes (z. B. neue Rangliste).
-- Dev-Pendant: 20260504200029_add_user_to_push_subscription.

ALTER TABLE "PushSubscription"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- FK + Index. Bestehende Zeilen behalten userId NULL — sie zaehlen damit als
-- anonym und werden vom App-Update-Broadcast ausgeschlossen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey'
  ) THEN
    ALTER TABLE "PushSubscription"
      ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription"("userId");
