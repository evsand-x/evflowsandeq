-- Catalogue only: this does not assign financial access to any role or user.
INSERT INTO "permissions" ("id", "code", "resource", "action", "description")
VALUES (gen_random_uuid(), 'finance.read', 'finance', 'read', 'Lihat Dashboard Finance sesuai scope perusahaan')
ON CONFLICT ("code") DO NOTHING;
