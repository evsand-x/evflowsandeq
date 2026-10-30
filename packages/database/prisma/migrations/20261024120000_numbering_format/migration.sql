-- Prefix.Year.Month.Sequence numbering: year format and reset period replace reset_yearly.
ALTER TABLE "document_number_rules"
  ADD COLUMN "year_format" TEXT NOT NULL DEFAULT 'YYYY',
  ADD COLUMN "reset_period" TEXT NOT NULL DEFAULT 'YEARLY';

-- No monthly rule existed, so every existing rule becomes YEARLY.
UPDATE "document_number_rules" SET "reset_period" = 'YEARLY';

-- Rules that never reset kept one counter under the bare document kind; the yearly key
-- continues from it so numbers do not restart in the current year.
INSERT INTO "master_code_sequences" ("id", "company_id", "entity_type", "next_value", "updated_at")
SELECT gen_random_uuid(), s."company_id", s."entity_type" || ':' || to_char(now(), 'YYYY'), s."next_value", now()
FROM "master_code_sequences" s
WHERE EXISTS (
  SELECT 1 FROM "document_number_rules" r
  WHERE r."company_id" = s."company_id" AND r."document_kind" = s."entity_type" AND r."reset_yearly" = false
)
AND NOT EXISTS (
  SELECT 1 FROM "master_code_sequences" t
  WHERE t."company_id" = s."company_id" AND t."entity_type" = s."entity_type" || ':' || to_char(now(), 'YYYY')
);

ALTER TABLE "document_number_rules" DROP COLUMN "reset_yearly";

ALTER TABLE "document_number_rules"
  ADD CONSTRAINT "document_number_rules_year_format_check" CHECK ("year_format" IN ('YYYY', 'YY')),
  ADD CONSTRAINT "document_number_rules_reset_period_check" CHECK ("reset_period" IN ('YEARLY', 'MONTHLY'));
