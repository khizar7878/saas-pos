-- Allow superadmin and admins/owners to sync and manage app_routes
DROP POLICY IF EXISTS "App routes insert policy" ON public.app_routes;
DROP POLICY IF EXISTS "App routes update policy" ON public.app_routes;
DROP POLICY IF EXISTS "App routes delete policy" ON public.app_routes;

CREATE POLICY "App routes insert policy" ON public.app_routes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "App routes update policy" ON public.app_routes
  FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_superadmin() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "App routes delete policy" ON public.app_routes
  FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.has_role(auth.uid(), 'admin'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
