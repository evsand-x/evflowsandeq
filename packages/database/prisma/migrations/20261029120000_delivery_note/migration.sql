CREATE TYPE "DeliveryNoteState" AS ENUM ('DRAFT','ISSUED','CANCELLED');
CREATE TABLE "delivery_notes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL, "sales_order_id" uuid NOT NULL,
  "number" text NOT NULL, "state" "DeliveryNoteState" NOT NULL DEFAULT 'DRAFT', "notes" text,
  "handover_at" timestamptz(6), "receiver_name" text, "evidence_id" uuid, "issued_at" timestamptz(6),
  "issued_by_id" uuid, "snapshot" jsonb, "handover_snapshot" jsonb, "issue_idempotency_key" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" uuid NOT NULL, CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_notes_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "delivery_notes_so_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "delivery_notes_company_number_key" ON "delivery_notes"("company_id","number");
CREATE UNIQUE INDEX "delivery_notes_company_issue_key" ON "delivery_notes"("company_id","issue_idempotency_key");
CREATE INDEX "delivery_notes_company_so_state_idx" ON "delivery_notes"("company_id","sales_order_id","state");
CREATE TABLE "delivery_note_lines" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL, "delivery_note_id" uuid NOT NULL,
  "sales_order_line_id" uuid NOT NULL, "quantity" numeric(24,10) NOT NULL, "delivered_quantity" numeric(24,10),
  "rejected_quantity" numeric(24,10) NOT NULL DEFAULT 0, "warehouse_id" uuid, "locator_id" uuid,
  "unit_price" numeric(24,8) NOT NULL, "tax_snapshot" jsonb, "cost_snapshot" jsonb,
  CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_note_lines_note_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT,
  CONSTRAINT "delivery_note_lines_sol_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT,
  CONSTRAINT "delivery_note_lines_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "delivery_note_lines_note_line_key" ON "delivery_note_lines"("delivery_note_id","sales_order_line_id");
CREATE INDEX "delivery_note_lines_company_sol_idx" ON "delivery_note_lines"("company_id","sales_order_line_id");
ALTER TABLE delivery_note_lines ADD CONSTRAINT delivery_note_quantity_positive CHECK (quantity > 0 AND rejected_quantity >= 0 AND (delivered_quantity IS NULL OR (delivered_quantity > 0 AND delivered_quantity + rejected_quantity <= quantity)));
ALTER TABLE delivery_notes ADD CONSTRAINT delivery_note_handover_required CHECK (state <> 'ISSUED' OR (handover_at IS NOT NULL AND receiver_name IS NOT NULL AND length(trim(receiver_name)) > 0 AND evidence_id IS NOT NULL AND issued_at IS NOT NULL AND issued_by_id IS NOT NULL AND issue_idempotency_key IS NOT NULL AND snapshot IS NOT NULL AND handover_snapshot IS NOT NULL));
CREATE TABLE outbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 event_type text NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at timestamptz(6)
);
CREATE UNIQUE INDEX outbox_events_company_event_aggregate_key ON outbox_events(company_id,event_type,aggregate_id);
CREATE INDEX outbox_events_published_created_idx ON outbox_events(published_at,created_at);
-- Defense in depth: posted sources and lines remain immutable, even outside application commands.
CREATE FUNCTION guard_delivery_note() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.state = 'ISSUED' THEN RAISE EXCEPTION 'DELIVERY_NOTE_IMMUTABLE'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 IF NOT EXISTS (SELECT 1 FROM sales_orders WHERE id=NEW.sales_order_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'DELIVERY_NOTE_COMPANY_MISMATCH'; END IF;
 IF NEW.evidence_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transaction_evidence WHERE id=NEW.evidence_id AND company_id=NEW.company_id AND purpose='SURAT_JALAN') THEN RAISE EXCEPTION 'SURAT_JALAN_EVIDENCE_REQUIRED'; END IF;
 IF NEW.state = 'ISSUED' AND (NOT EXISTS (SELECT 1 FROM delivery_note_lines WHERE delivery_note_id=NEW.id) OR EXISTS (SELECT 1 FROM delivery_note_lines WHERE delivery_note_id=NEW.id AND delivered_quantity IS NULL)) THEN RAISE EXCEPTION 'DELIVERY_NOTE_LINES_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_note_guard BEFORE INSERT OR UPDATE OR DELETE ON delivery_notes FOR EACH ROW EXECUTE FUNCTION guard_delivery_note();
CREATE FUNCTION guard_delivery_note_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE note delivery_notes;
BEGIN
 IF TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM delivery_notes WHERE id=OLD.delivery_note_id AND state='ISSUED') THEN RAISE EXCEPTION 'DELIVERY_NOTE_IMMUTABLE'; END IF;
 SELECT * INTO note FROM delivery_notes WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.delivery_note_id ELSE NEW.delivery_note_id END FOR UPDATE;
 IF note.state='ISSUED' THEN RAISE EXCEPTION 'DELIVERY_NOTE_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF note.company_id <> NEW.company_id OR NOT EXISTS (SELECT 1 FROM sales_order_lines WHERE id=NEW.sales_order_line_id AND company_id=NEW.company_id AND sales_order_id=note.sales_order_id) THEN RAISE EXCEPTION 'DELIVERY_NOTE_LINE_SCOPE_INVALID'; END IF;
 IF NEW.warehouse_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM warehouses WHERE id=NEW.warehouse_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'DELIVERY_NOTE_WAREHOUSE_INVALID'; END IF;
 IF NEW.locator_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locators WHERE id=NEW.locator_id AND company_id=NEW.company_id AND warehouse_id=NEW.warehouse_id) THEN RAISE EXCEPTION 'DELIVERY_NOTE_LOCATOR_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_note_line_guard BEFORE INSERT OR UPDATE OR DELETE ON delivery_note_lines FOR EACH ROW EXECUTE FUNCTION guard_delivery_note_line();


ALTER TABLE delivery_notes
  ADD CONSTRAINT delivery_notes_evidence_fkey FOREIGN KEY (evidence_id) REFERENCES transaction_evidence(id) ON DELETE RESTRICT,
  ADD CONSTRAINT delivery_notes_issued_by_fkey FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT delivery_notes_created_by_fkey FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE delivery_note_lines
  ADD CONSTRAINT delivery_note_lines_warehouse_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT delivery_note_lines_locator_fkey FOREIGN KEY (locator_id) REFERENCES locators(id) ON DELETE RESTRICT;
