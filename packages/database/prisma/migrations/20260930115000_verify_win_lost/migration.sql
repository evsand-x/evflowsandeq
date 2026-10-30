-- AlterTable
ALTER TABLE "public"."attachments" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "scanned_at" SET DATA TYPE TIMESTAMP(3);

-- RenameForeignKey
ALTER TABLE "public"."quote_lines" RENAME CONSTRAINT "quote_lines_source_need_id_fkey" TO "quote_source_need_fkey";

-- RenameIndex
ALTER INDEX "public"."quote_lines_quote_id_source_need_id_key" RENAME TO "quote_source_need_unique";
