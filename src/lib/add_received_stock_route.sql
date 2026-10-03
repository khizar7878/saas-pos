INSERT INTO public.app_routes (path, name, parent_name, icon_name, sort_order)
VALUES ('/reports/received-stock', 'Received Stock', 'Reports', 'PackagePlus', 9)
ON CONFLICT (path) DO NOTHING;
