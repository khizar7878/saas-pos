import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  custom_role_name?: string | null;
}

interface RoutePermission {
  path: string;
  name: string;
  parent_name: string | null;
  icon_name: string | null;
  sort_order: number;
}

interface PermissionsContextType {
  userProfile: UserProfile | null;
  allowedRoutes: RoutePermission[];
  isAdmin: boolean;
  loading: boolean;
  hasRouteAccess: (path: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const ADMIN_EMAIL = 'khizarhayat0015@gmail.com';

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allowedRoutes, setAllowedRoutes] = useState<RoutePermission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!user) {
      setUserProfile(null);
      setAllowedRoutes([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user has admin role using the secure RPC function
      const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      // Fallback for bootstrap admin
      const isBootstrapAdmin = user.email === ADMIN_EMAIL;
      const userIsAdmin = hasAdminRole === true || isBootstrapAdmin;
      
      setIsAdmin(userIsAdmin);

      // Fetch user profile
      let { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // If no profile and this is the admin email, bootstrap it
      if (profileError && isBootstrapAdmin) {
        // Try to bootstrap admin via edge function
        try {
          const { error: bootstrapError } = await supabase.functions.invoke('manage-users', {
            body: { action: 'bootstrap-admin' }
          });
          
          if (!bootstrapError) {
            // Retry fetching profile
            const { data: newProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            profile = newProfile;
          }
        } catch (e) {
          console.error('Bootstrap error:', e);
        }

        // If still no profile, create a temporary one for display
        if (!profile) {
          profile = {
            id: user.id,
            email: user.email || ADMIN_EMAIL,
            full_name: 'Administrator',
            is_admin: true,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }

      if (profileError && !isBootstrapAdmin) {
        console.error('Error fetching profile:', profileError);
        // User has no profile - they shouldn't have access
        setUserProfile(null);
        setAllowedRoutes([]);
        setLoading(false);
        return;
      }

      // Override is_admin with the secure role check
      if (profile) {
        profile.is_admin = userIsAdmin;
      }
      
      setUserProfile(profile);

      // Fetch allowed routes
      if (userIsAdmin) {
        // Admin gets all routes
        const { data: routes } = await supabase
          .from('app_routes')
          .select('path, name, parent_name, icon_name, sort_order')
          .order('sort_order');
        setAllowedRoutes(routes || []);
      } else {
        // Regular user - fetch their specific permissions
        const { data: permissions } = await supabase
          .from('user_route_permissions')
          .select(`
            route_id,
            app_routes!inner (
              path,
              name,
              parent_name,
              icon_name,
              sort_order
            )
          `)
          .eq('user_id', user.id);

        const routes = permissions?.map((p: any) => ({
          path: p.app_routes.path,
          name: p.app_routes.name,
          parent_name: p.app_routes.parent_name,
          icon_name: p.app_routes.icon_name,
          sort_order: p.app_routes.sort_order,
        })) || [];

        setAllowedRoutes(routes.sort((a, b) => a.sort_order - b.sort_order));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const hasRouteAccess = (path: string): boolean => {
    if (!userProfile) return false;
    if (!userProfile.is_active) return false;
    if (isAdmin) return true;
    
    // Root dashboard is always accessible to active store staff
    if (path === '/' || path === '') return true;

    // If explicit routes exist in user_route_permissions, enforce them
    if (allowedRoutes.length > 0) {
      return allowedRoutes.some(route => {
        // Exact match
        if (route.path === path) return true;
        // Check if it's a sub-route (e.g., /inventory matches /inventory/products)
        if (path.startsWith(route.path + '/')) return true;
        return false;
      });
    }

    // Default fallback for staff members who don't have custom route restrictions:
    // Cashiers and staff get standard operational till and sales routes
    const defaultStaffRoutes = ['/', '/pos/sales', '/pos/returns', '/customers', '/pos/pending-payments'];
    return defaultStaffRoutes.includes(path);
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await fetchPermissions();
  };

  return (
    <PermissionsContext.Provider 
      value={{ 
        userProfile, 
        allowedRoutes, 
        isAdmin,
        loading,
        hasRouteAccess,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
