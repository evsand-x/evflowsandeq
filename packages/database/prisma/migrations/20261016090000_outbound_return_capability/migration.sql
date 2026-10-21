-- Register the capability already enforced by the return command; no automatic grants.
INSERT INTO permissions(id,code,resource,action,description)
VALUES (gen_random_uuid(),'customer_return.receive','customer_return','receive','Read return sources and receive customer goods into quarantine')
ON CONFLICT (code) DO NOTHING;
