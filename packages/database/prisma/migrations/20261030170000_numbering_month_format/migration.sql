ALTER TABLE "document_number_rules"
  ADD COLUMN "month_format" TEXT NOT NULL DEFAULT 'ARABIC';

ALTER TABLE "document_number_rules"
  ADD CONSTRAINT "document_number_rules_month_format_check"
  CHECK ("month_format" IN ('ARABIC', 'ROMAN'));
