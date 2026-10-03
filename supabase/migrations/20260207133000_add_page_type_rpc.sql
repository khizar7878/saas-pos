-- Add function to determine page type for user
CREATE OR REPLACE FUNCTION get_user_page_type_for_cart(_user_id uuid)
RETURNS TEXT AS $$
DECLARE
    has_sales_access BOOLEAN;
    is_user_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 
        FROM user_profiles 
        WHERE id = _user_id 
        AND role = 'admin'
    ) INTO is_user_admin;
    
    -- Admins have access to sales
    IF is_user_admin THEN
        RETURN 'sales';
    END IF;
    
    -- Check if user has access to /pos/sales route
    SELECT EXISTS (
        SELECT 1 
        FROM user_route_permissions urp
        JOIN app_routes ar ON ar.id = urp.route_id
        WHERE urp.user_id = _user_id 
        AND ar.path = '/pos/sales'
    ) INTO has_sales_access;
    
    -- Return appropriate page type
    IF has_sales_access THEN
        RETURN 'sales';
    ELSE
        RETURN 'forwarding';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure REPLICA IDENTITY FULL is enabled (Repeating just in case)
ALTER TABLE public.held_carts REPLICA IDENTITY FULL;
