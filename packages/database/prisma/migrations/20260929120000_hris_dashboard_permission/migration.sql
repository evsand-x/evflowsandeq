-- Catalogue only: no assignment and no permission to view payroll amounts or private documents.
INSERT INTO "permissions" ("id", "code", "resource", "action", "description")
VALUES (gen_random_uuid(), 'hr.read', 'hr', 'read', 'Lihat status Dashboard HRIS sesuai scope perusahaan')
ON CONFLICT ("code") DO NOTHING;
