-- Cleanup deleted routes from app_routes table
DELETE FROM public.app_routes
WHERE path IN (
    '/pos/forward',
    '/reports/expenses',
    '/reports/day-summary',
    '/treasury/cash-in-hand',
    '/treasury/cash-in-drawer',
    '/expenses',
    '/setup/security'
);

-- Add new active routes that might be missing
INSERT INTO public.app_routes (name, path, parent_name, icon_name, sort_order) VALUES
    ('Pending Payments', '/pos/pending-payments', 'Point of Sale', 'Clock', 13),
    ('Delivered Bills', '/reports/delivered-bills', 'Reports', 'FileText', 28),
    ('Stock Report', '/reports/stock-report', 'Reports', 'ClipboardList', 29)
ON CONFLICT (path) DO NOTHING;
