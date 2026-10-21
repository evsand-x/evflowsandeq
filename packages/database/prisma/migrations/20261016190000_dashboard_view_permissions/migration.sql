-- Dashboard tabs are independently configurable. Existing roles are not expanded.
INSERT INTO permissions (id, code, resource, action, description)
VALUES
  (gen_random_uuid(), 'dashboard_executive.read', 'dashboard_executive', 'read', 'View Executive Dashboard'),
  (gen_random_uuid(), 'dashboard_sales.read', 'dashboard_sales', 'read', 'View Sales Dashboard'),
  (gen_random_uuid(), 'dashboard_warehouse.read', 'dashboard_warehouse', 'read', 'View Warehouse Dashboard'),
  (gen_random_uuid(), 'dashboard_finance.read', 'dashboard_finance', 'read', 'View Finance Dashboard'),
  (gen_random_uuid(), 'dashboard_hris.read', 'dashboard_hris', 'read', 'View HRIS Dashboard'),
  (gen_random_uuid(), 'dashboard_actions.read', 'dashboard_actions', 'read', 'View Dashboard tasks and approvals'),
  (gen_random_uuid(), 'dashboard_reports.read', 'dashboard_reports', 'read', 'View Dashboard report catalog and exports')
ON CONFLICT (code) DO NOTHING;
