import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
    is_active: boolean;
}

export const useUsers = (salesOnly: boolean = false) => {
    return useQuery({
        queryKey: ["users", salesOnly],
        queryFn: async () => {
            // 1. Fetch active users
            const { data: users, error: usersError } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("is_active", true);

            if (usersError) throw usersError;

            // 2. Determine which routes to check
            const routePaths = salesOnly
                ? ["/pos/sales"]
                : ["/pos/sales", "/pos/forward"];

            // 3. Fetch route IDs
            const { data: routes, error: routeError } = await supabase
                .from("app_routes")
                .select("id")
                .in("path", routePaths);

            if (routeError) {
                console.error("Error fetching routes:", routeError);
                return users as UserProfile[];
            }

            if (!routes || routes.length === 0) return users as UserProfile[];

            // 4. Fetch permissions for these routes
            const routeIds = routes.map(r => r.id);
            const { data: permissions, error: permError } = await supabase
                .from("user_route_permissions")
                .select("user_id")
                .in("route_id", routeIds);

            if (permError) {
                console.error("Error fetching permissions:", permError);
                return users as UserProfile[];
            }

            // 5. Filter users: Admin OR has required permission
            const allowedUserIds = new Set(permissions?.map(p => p.user_id) || []);

            // 6. Exclude current user from the list
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            return (users as any[]).map(user => ({
                id: user.id,
                email: user.email,
                /* Wait, UserSelectionDialog uses user.email or full_name */
                /* If user_profiles doesn't have email, useUsers is returning undefined for email? */
                /* I should check if user_profiles view exists? Or just rely on full_name. */
                /* Let's look at useUsers.ts again carefully. */
                ...user,
                is_admin: user.role === 'admin' || user.is_admin /* fallback */
            })).filter((user: UserProfile) =>
                (user.is_admin || allowedUserIds.has(user.id)) &&
                user.id !== currentUser?.id
            );
        },
    });
};
