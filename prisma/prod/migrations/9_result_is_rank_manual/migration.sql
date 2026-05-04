-- Result.isRankManual: schuetzt manuell vergebene Plaetze gegen Auto-Rerank
-- beim Editieren anderer Eintraege derselben Regatta. Default false, damit
-- bestehende Eintraege weiterhin auto-gerankt werden.
-- Dev-Pendant: 20260504151907_add_is_rank_manual_to_result.

ALTER TABLE "Result"
  ADD COLUMN IF NOT EXISTS "isRankManual" BOOLEAN NOT NULL DEFAULT false;
