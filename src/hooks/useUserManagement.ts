import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  custom_role_name: string | null;
  created_at: string;
  updated_at: string;
}

interface AppRoute {
  id: string;
  name: string;
  path: string;
  parent_name: string | null;
  icon_name: string | null;
  sort_order: number;
}

interface UserRoutePermission {
  id: string;
  user_id: string;
  route_id: string;
}

export function useUserManagement() {
  const queryClient = useQueryClient();

  const toFunctionsInvokeError = async (error: unknown) => {
    const err: any = error;
    let message = err?.message || 'Failed to call edge function';

     const getResponseFromContext = (ctx: any): Response | null => {
       if (!ctx) return null;
       // Most common shape in supabase-js: context is a Response
       if (typeof ctx?.status === 'number' && typeof ctx?.clone === 'function') return ctx as Response;
       // Sometimes context may be { response: Response }
       const res = ctx?.response;
       if (res && typeof res?.status === 'number' && typeof res?.clone === 'function') return res as Response;
       return null;
     };

    // supabase-js FunctionsHttpError includes `context: Response`
    const ctx = err?.context;
    const res = getResponseFromContext(ctx);
    if (res) {
      try {
        const bodyText = await res.clone().text();
        const statusLine = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
        message = `${message} (${statusLine})${bodyText ? `: ${bodyText}` : ''}`;
      } catch {
        // ignore body read failures
      }
    }

    return new Error(message);
  };

  const toUserFacingMessage = async (error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    // fall back to a readable string without crashing
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  };

  // Fetch all users (admin only)
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Fetch all routes
  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['app-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_routes')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data as AppRoute[];
    },
  });

  // Fetch permissions for a specific user
  const getUserPermissions = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('user_route_permissions')
      .select('route_id')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data.map(p => p.route_id);
  };

  // Create new user (requires edge function for auth user creation)
  const createUser = useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      fullName, 
      isAdmin,
      routeIds,
      customRoleName
    }: { 
      email: string; 
      password: string; 
      fullName: string;
      isAdmin: boolean;
      routeIds: string[];
      customRoleName?: string;
    }) => {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'create',
          email, 
          password, 
          fullName,
          isAdmin,
          routeIds 
        },
      });
      
      if (error) {
        console.error('Edge function error (create):', error);
        throw await toFunctionsInvokeError(error);
      }
      
      // Check if the response contains an error
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Update custom role name if provided
      if (customRoleName && data?.userId) {
        const { error: roleNameError } = await supabase
          .from('user_profiles')
          .update({ custom_role_name: customRoleName })
          .eq('id', data.userId);
        
        if (roleNameError) {
          console.error('Failed to set custom role name:', roleNameError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      console.error('Create user error:', error);
      // Show details even if the title stays generic
      void (async () => {
        const details = await toUserFacingMessage(error);
        toast.error('Failed to create user', {
          description: details,
          duration: 10000,
        });
      })();
    },
  });

  // Update user profile
  const updateUser = useMutation({
    mutationFn: async ({ 
      userId, 
      fullName, 
      isActive,
      isAdmin,
      customRoleName
    }: { 
      userId: string; 
      fullName?: string; 
      isActive?: boolean;
      isAdmin?: boolean;
      customRoleName?: string;
    }) => {
      const updates: any = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (isActive !== undefined) updates.is_active = isActive;
      if (isAdmin !== undefined) updates.is_admin = isAdmin;
      if (customRoleName !== undefined) updates.custom_role_name = customRoleName;

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      toast.success('User updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update user');
    },
  });

  // Update user permissions
  const updatePermissions = useMutation({
    mutationFn: async ({ 
      userId, 
      routeIds 
    }: { 
      userId: string; 
      routeIds: string[];
    }) => {
      // Delete existing permissions
      await supabase
        .from('user_route_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions
      if (routeIds.length > 0) {
        const { error } = await supabase
          .from('user_route_permissions')
          .insert(routeIds.map(routeId => ({
            user_id: userId,
            route_id: routeId,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Permissions updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update permissions');
    },
  });

  // Delete user
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'delete',
          userId 
        },
      });
      
      if (error) {
        console.error('Edge function error (delete):', error);
        throw await toFunctionsInvokeError(error);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      console.error('Delete user error:', error);
      toast.error(error.message || 'Failed to delete user');
    },
  });

  // Reset user password
  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'reset-password',
          userId,
          newPassword 
        },
      });
      
      if (error) {
        console.error('Edge function error (reset-password):', error);
        throw await toFunctionsInvokeError(error);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: (error: any) => {
      console.error('Reset password error:', error);
      toast.error(error.message || 'Failed to reset password');
    },
  });

  return {
    users,
    routes,
    usersLoading,
    routesLoading,
    usersError,
    getUserPermissions,
    createUser,
    updateUser,
    updatePermissions,
    deleteUser,
    resetPassword,
  };
}
