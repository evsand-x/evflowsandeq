-- Register the read capability only. Role assignments remain an explicit IAM action.
INSERT INTO "permissions" ("id", "code", "resource", "action", "description")
VALUES (gen_random_uuid(), 'warehouse.read', 'warehouse', 'read', 'Lihat Dashboard Warehouse dan pilihan gudang sesuai scope')
ON CONFLICT ("code") DO NOTHING;
