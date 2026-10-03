import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { navigationConfig } from '@/config/navigation';
import { usePermissions } from '@/contexts/PermissionsContext';

export function useRouteSync() {
    const { isAdmin } = usePermissions();
    const hasSynced = useRef(false);

    useEffect(() => {
        if (!isAdmin || hasSynced.current) return;

        const syncRoutes = async () => {
            console.log('Syncing application routes...');

            const routesToUpsert = [];
            let globalSortOrder = 0;

            for (const section of navigationConfig) {
                for (const item of section.items) {
                    routesToUpsert.push({
                        name: item.title,
                        path: item.path,
                        parent_name: section.title === "Main" ? null : section.title,
                        icon_name: item.iconName,
                        sort_order: globalSortOrder++
                    });
                }
            }

            // We use upsert based on 'path' constraint. 
            // Note: 'path' must be unique in DB for this to work perfectly without ID.
            // If no unique constraint on path, we might need a different strategy, 
            // but typically path is unique for permissions.

            const { error } = await supabase
                .from('app_routes')
                .upsert(routesToUpsert, { onConflict: 'path' });

            if (error) {
                console.error('Failed to sync routes:', error);
            } else {
                console.log('Routes synced successfully');
            }

            hasSynced.current = true;
        };

        syncRoutes();
    }, [isAdmin]);
}
