-- Replace shared grants with explicit child grants; preserve actions and scopes.
BEGIN;
LOCK TABLE roles, permissions, role_permissions, user_roles IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE submenu_permission_map (old_code text, code text, resource text, action text) ON COMMIT DROP;
INSERT INTO submenu_permission_map VALUES
  ('sales_order.read', 'sales_backorder.read', 'sales_backorder', 'read'),
  ('sales_order.read', 'warehouse_allocation.read', 'warehouse_allocation', 'read'),
  ('sales_order.read', 'proforma.read', 'proforma', 'read'),
  ('proforma.issue', 'proforma.read', 'proforma', 'read'),
  ('crm.read', 'crm_prospect.read', 'crm_prospect', 'read'),
  ('crm.create', 'crm_prospect.create', 'crm_prospect', 'create'),
  ('crm.update', 'crm_prospect.update', 'crm_prospect', 'update'),
  ('crm.read', 'crm_contact.read', 'crm_contact', 'read'),
  ('crm.create', 'crm_contact.create', 'crm_contact', 'create'),
  ('crm.update', 'crm_contact.update', 'crm_contact', 'update'),
  ('crm.read', 'crm_opportunity.read', 'crm_opportunity', 'read'),
  ('crm.create', 'crm_opportunity.create', 'crm_opportunity', 'create'),
  ('crm.update', 'crm_opportunity.update', 'crm_opportunity', 'update'),
  ('crm.read', 'crm_activity.read', 'crm_activity', 'read'),
  ('crm.create', 'crm_activity.create', 'crm_activity', 'create'),
  ('crm.read', 'crm_quote.read', 'crm_quote', 'read'),
  ('crm.create', 'crm_quote.create', 'crm_quote', 'create'),
  ('crm.create', 'crm_customer_order.create', 'crm_customer_order', 'create'),
  ('crm.update', 'crm_customer_order.update', 'crm_customer_order', 'update'),
  ('master_data.read', 'master_product.read', 'master_product', 'read'),
  ('master_data.create', 'master_product.create', 'master_product', 'create'),
  ('master_data.update', 'master_product.update', 'master_product', 'update'),
  ('master_data.activate', 'master_product.activate', 'master_product', 'activate'),
  ('master_data.read', 'master_customer.read', 'master_customer', 'read'),
  ('master_data.create', 'master_customer.create', 'master_customer', 'create'),
  ('master_data.update', 'master_customer.update', 'master_customer', 'update'),
  ('master_data.activate', 'master_customer.activate', 'master_customer', 'activate'),
  ('master_data.read', 'master_supplier.read', 'master_supplier', 'read'),
  ('master_data.create', 'master_supplier.create', 'master_supplier', 'create'),
  ('master_data.update', 'master_supplier.update', 'master_supplier', 'update'),
  ('master_data.activate', 'master_supplier.activate', 'master_supplier', 'activate'),
  ('master_data.read', 'master_vendor.read', 'master_vendor', 'read'),
  ('master_data.create', 'master_vendor.create', 'master_vendor', 'create'),
  ('master_data.update', 'master_vendor.update', 'master_vendor', 'update'),
  ('master_data.activate', 'master_vendor.activate', 'master_vendor', 'activate'),
  ('master_data.read', 'master_warehouse.read', 'master_warehouse', 'read'),
  ('master_data.create', 'master_warehouse.create', 'master_warehouse', 'create'),
  ('master_data.update', 'master_warehouse.update', 'master_warehouse', 'update'),
  ('master_data.activate', 'master_warehouse.activate', 'master_warehouse', 'activate'),
  ('master_data.read', 'master_locator.read', 'master_locator', 'read'),
  ('master_data.create', 'master_locator.create', 'master_locator', 'create'),
  ('master_data.update', 'master_locator.update', 'master_locator', 'update'),
  ('master_data.activate', 'master_locator.activate', 'master_locator', 'activate'),
  ('master_data.read', 'master_operational_item.read', 'master_operational_item', 'read'),
  ('master_data.create', 'master_operational_item.create', 'master_operational_item', 'create'),
  ('master_data.update', 'master_operational_item.update', 'master_operational_item', 'update'),
  ('master_data.activate', 'master_operational_item.activate', 'master_operational_item', 'activate'),
  ('master_data.read', 'master_product_category.read', 'master_product_category', 'read'),
  ('master_data.create', 'master_product_category.create', 'master_product_category', 'create'),
  ('master_data.update', 'master_product_category.update', 'master_product_category', 'update'),
  ('master_data.activate', 'master_product_category.activate', 'master_product_category', 'activate'),
  ('master_data.read', 'master_uom.read', 'master_uom', 'read'),
  ('master_data.create', 'master_uom.create', 'master_uom', 'create'),
  ('master_data.update', 'master_uom.update', 'master_uom', 'update'),
  ('master_data.activate', 'master_uom.activate', 'master_uom', 'activate'),
  ('master_data.read', 'master_customer_channel.read', 'master_customer_channel', 'read'),
  ('master_data.create', 'master_customer_channel.create', 'master_customer_channel', 'create'),
  ('master_data.update', 'master_customer_channel.update', 'master_customer_channel', 'update'),
  ('master_data.activate', 'master_customer_channel.activate', 'master_customer_channel', 'activate'),
  ('master_data.read', 'master_rayon.read', 'master_rayon', 'read'),
  ('master_data.create', 'master_rayon.create', 'master_rayon', 'create'),
  ('master_data.update', 'master_rayon.update', 'master_rayon', 'update'),
  ('master_data.activate', 'master_rayon.activate', 'master_rayon', 'activate'),
  ('master_data.read', 'crm_customer.read', 'crm_customer', 'read'),
  ('master_data.create', 'crm_customer.create', 'crm_customer', 'create'),
  ('fulfillment.read', 'outbound_picking.read', 'outbound_picking', 'read'),
  ('fulfillment.read', 'outbound_checking.read', 'outbound_checking', 'read'),
  ('fulfillment.read', 'outbound_shipping.read', 'outbound_shipping', 'read'),
  ('fulfillment.read', 'delivery_receipt.read', 'delivery_receipt', 'read');
INSERT INTO permissions (id, code, resource, action, description)
SELECT gen_random_uuid(), code, resource, action, 'Independent submenu capability'
FROM (SELECT DISTINCT code, resource, action FROM submenu_permission_map) catalog ON CONFLICT (code) DO NOTHING;
CREATE TEMP TABLE submenu_old_grants ON COMMIT DROP AS
SELECT rp.*, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
WHERE p.code IN (SELECT old_code FROM submenu_permission_map);
INSERT INTO role_permissions (id, company_id, role_id, permission_id, scope_type, scope_id)
SELECT gen_random_uuid(), expanded.company_id, expanded.role_id, expanded.permission_id, expanded.scope_type, expanded.scope_id
FROM (SELECT DISTINCT g.company_id, g.role_id, p.id AS permission_id, g.scope_type, g.scope_id
FROM submenu_old_grants g JOIN submenu_permission_map m ON m.old_code = g.code
JOIN permissions p ON p.code = m.code
WHERE NOT EXISTS (SELECT 1 FROM role_permissions existing WHERE existing.role_id = g.role_id
 AND existing.permission_id = p.id AND existing.scope_type = g.scope_type
 AND existing.scope_id IS NOT DISTINCT FROM g.scope_id)) expanded;
INSERT INTO audit_events (id, company_id, actor_id, action, resource_type, resource_id, reason, metadata)
SELECT gen_random_uuid(), g.company_id, NULL, 'role.permissions.migrated', 'role', g.role_id,
 'Replace shared parent permissions with independent submenu grants',
 jsonb_build_object('migration', '20261016210000_independent_submenu_permissions',
 'old_grants', jsonb_agg(jsonb_build_object('code', g.code, 'scope_type', g.scope_type, 'scope_id', g.scope_id)),
 'mapping', (SELECT jsonb_agg(to_jsonb(m)) FROM submenu_permission_map m))
FROM submenu_old_grants g GROUP BY g.company_id, g.role_id;
UPDATE auth_sessions s SET revoked_at = now(), revoked_reason = 'Submenu permission migration'
WHERE s.revoked_at IS NULL AND EXISTS (
 SELECT 1 FROM user_roles ur JOIN submenu_old_grants g ON g.role_id = ur.role_id AND g.company_id = ur.company_id
 WHERE ur.membership_id = s.membership_id AND ur.company_id = s.company_id)
AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id AND r.company_id = ur.company_id
 WHERE ur.membership_id = s.membership_id AND ur.company_id = s.company_id AND r.code = 'ADMIN_SYSTEM' AND r.active);
DELETE FROM role_permissions WHERE id IN (SELECT id FROM submenu_old_grants WHERE code NOT IN ('sales_order.read', 'proforma.issue'));
DELETE FROM permissions WHERE code IN (SELECT old_code FROM submenu_permission_map WHERE old_code NOT IN ('sales_order.read', 'proforma.issue'));
-- Existing commands already have distinct codes; place them on their owning submenu.
UPDATE permissions SET resource = 'outbound_picking' WHERE code = 'fulfillment.pick';
UPDATE permissions SET resource = 'outbound_checking' WHERE code IN ('fulfillment.check', 'fulfillment.release');
UPDATE permissions SET resource = 'outbound_shipping' WHERE code = 'fulfillment.dispatch';
COMMIT;
