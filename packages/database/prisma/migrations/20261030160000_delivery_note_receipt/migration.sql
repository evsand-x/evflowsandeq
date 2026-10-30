-- Issue remains immutable and financial; receipt is an independent append-only record.
ALTER TABLE delivery_notes DROP CONSTRAINT delivery_note_handover_required;
ALTER TABLE delivery_notes ADD CONSTRAINT delivery_note_issue_required CHECK (
  state <> 'ISSUED' OR (issued_at IS NOT NULL AND issued_by_id IS NOT NULL
  AND issue_idempotency_key IS NOT NULL AND snapshot IS NOT NULL)
);

CREATE TABLE delivery_note_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE RESTRICT,
  handover_at timestamptz(6) NOT NULL,
  receiver_name text NOT NULL CHECK (length(trim(receiver_name)) > 0),
  receiver_title text,
  evidence_id uuid NOT NULL REFERENCES transaction_evidence(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  recorded_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX delivery_note_receipts_delivery_note_id_key ON delivery_note_receipts(delivery_note_id);
CREATE INDEX delivery_note_receipts_company_id_delivery_note_id_idx ON delivery_note_receipts(company_id, delivery_note_id);

CREATE FUNCTION guard_delivery_note_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE note delivery_notes;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'DELIVERY_NOTE_RECEIPT_IMMUTABLE'; END IF;
  SELECT * INTO note FROM delivery_notes WHERE id=NEW.delivery_note_id FOR UPDATE;
  IF note.id IS NULL OR note.company_id <> NEW.company_id THEN RAISE EXCEPTION 'DELIVERY_NOTE_COMPANY_MISMATCH'; END IF;
  IF note.state <> 'ISSUED' THEN RAISE EXCEPTION 'DELIVERY_NOTE_NOT_ISSUED'; END IF;
  IF note.handover_at IS NOT NULL THEN RAISE EXCEPTION 'DELIVERY_NOTE_ALREADY_RECEIVED'; END IF;
  IF NEW.handover_at < note.issued_at THEN RAISE EXCEPTION 'DELIVERY_NOTE_RECEIPT_DATE_INVALID'; END IF;
  IF NOT EXISTS (SELECT 1 FROM transaction_evidence WHERE id=NEW.evidence_id AND company_id=NEW.company_id AND purpose='SURAT_JALAN') THEN RAISE EXCEPTION 'SURAT_JALAN_EVIDENCE_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER delivery_note_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON delivery_note_receipts FOR EACH ROW EXECUTE FUNCTION guard_delivery_note_receipt();
