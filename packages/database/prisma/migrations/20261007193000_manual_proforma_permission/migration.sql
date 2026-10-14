-- Capability registration only: role assignments remain administrator-managed.
INSERT INTO permissions (id, code, resource, action, description)
VALUES (gen_random_uuid(), 'proforma.issue', 'proforma', 'issue', 'Menerbitkan proforma secara manual dari alokasi tahap pemenuhan')
ON CONFLICT DO NOTHING;
