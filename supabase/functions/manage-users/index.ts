import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "khizarhayat0015@gmail.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client for checking permissions (uses user's JWT)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for user management (uses service role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the requesting user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Checking admin status for user:", user.id, user.email);

    // Check if user has admin role using the secure has_role function
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    console.log("has_role result:", hasAdminRole, "error:", roleError);

    // Allow if user has admin role OR if this is the bootstrap admin email
    const isBootstrapAdmin = user.email === ADMIN_EMAIL;
    const isAdmin = hasAdminRole === true || isBootstrapAdmin;

    console.log("isAdmin:", isAdmin, "isBootstrapAdmin:", isBootstrapAdmin);

    if (!isAdmin) {
      throw new Error("Forbidden: Admin access required");
    }

    // Parse request body
    const { action, ...params } = await req.json();
    console.log("Action:", action, "Params:", JSON.stringify(params));

    let result;

    switch (action) {
      case "create": {
        const { email, password, fullName, isAdmin: newUserIsAdmin, routeIds } = params;

        // Create auth user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Skip email confirmation for admin-created users
          user_metadata: {
            full_name: fullName,
            role: newUserIsAdmin ? 'admin' : 'cashier'
          }
        });

        if (createError) {
          console.error("Create user error:", createError);
          throw new Error(createError.message);
        }

        console.log("Created auth user:", newUser.user.id);

        // Create profile (upsert to handle trigger conflict)
        const { error: profileError } = await supabaseAdmin
          .from("user_profiles")
          .upsert({
            id: newUser.user.id,
            full_name: fullName,
            role: newUserIsAdmin ? 'admin' : 'cashier',
            is_active: true,
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error("Profile error:", profileError);
          // Rollback: delete the auth user
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          throw new Error(profileError.message);
        }

        console.log("Created/Updated profile");

        // Add role to user_roles table
        if (newUserIsAdmin) {
          const { error: roleInsertError } = await supabaseAdmin
            .from("user_roles")
            .insert({
              user_id: newUser.user.id,
              role: 'admin',
            });

          if (roleInsertError) {
            console.error("Role insert error:", roleInsertError);
            // Non-fatal, continue
          } else {
            console.log("Added admin role");
          }
        }

        // Add route permissions (if not admin and routes provided)
        if (!newUserIsAdmin && routeIds && routeIds.length > 0) {
          const { error: permError } = await supabaseAdmin
            .from("user_route_permissions")
            .insert(routeIds.map((routeId: string) => ({
              user_id: newUser.user.id,
              route_id: routeId,
            })));

          if (permError) {
            console.error("Error adding permissions:", permError);
          }
        }

        result = { success: true, userId: newUser.user.id };
        break;
      }

      case "delete": {
        const { userId } = params;

        // Prevent self-deletion
        if (userId === user.id) {
          throw new Error("Cannot delete your own account");
        }

        // Delete from auth (this will cascade to user_profiles and user_roles due to FK)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
          throw new Error(deleteError.message);
        }

        result = { success: true };
        break;
      }

      case "reset-password": {
        const { userId, newPassword } = params;

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        });

        if (resetError) {
          throw new Error(resetError.message);
        }

        result = { success: true };
        break;
      }

      case "bootstrap-admin": {
        // Special action to create admin profile and role for the first admin
        if (user.email !== ADMIN_EMAIL) {
          throw new Error("Only the primary admin can bootstrap");
        }

        // Check if profile already exists
        const { data: existing } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existing) {
          const { error: insertError } = await supabaseAdmin
            .from("user_profiles")
            .insert({
              id: user.id,
              full_name: "Administrator",
              is_admin: true,
              is_active: true,
            });

          if (insertError) {
            console.error("Bootstrap profile error:", insertError);
            throw new Error(insertError.message);
          }
        }

        // Ensure admin role exists in user_roles table
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert({
            user_id: user.id,
            role: 'admin',
          }, {
            onConflict: 'user_id,role'
          });

        if (roleError) {
          console.error("Bootstrap role error:", roleError);
          // Non-fatal for backwards compatibility
        }

        result = { success: true, message: "Admin profile and role created" };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: errorMessage === "Unauthorized" ? 401 :
          errorMessage.includes("Forbidden") ? 403 : 400,
      }
    );
  }
});
