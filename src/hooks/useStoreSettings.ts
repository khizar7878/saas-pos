import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoreSettings {
    id: number;
    store_id: string;
    store_name: string;
    address: string | null;
    phone: string | null;
    alt_phone: string | null;
    email: string | null;
    website?: string | null;
    header_text: string | null;
    footer_text: string | null;
    exchange_policy: string | null;
    logo_url: string | null;
    store_logo_url?: string | null;
    bill_logo_url?: string | null;
    fbr_integration_enabled: boolean;
    fbr_pos_id: string;
    fbr_api_url: string;
    fbr_environment: 'sandbox' | 'production';
    weekly_off_days?: string[] | null;
}

const DEMO_STORE_ID = "11111111-1111-1111-1111-111111111111";

export const getActiveStoreId = (): string => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('saas_active_store_id');
        if (stored) return stored;
    }
    return DEMO_STORE_ID;
};

export const useStoreSettings = () => {
    const storeId = getActiveStoreId();

    return useQuery({
        queryKey: ['store-settings', storeId],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from('store_settings')
                    .select('*')
                    .eq('store_id', storeId)
                    .maybeSingle();

                if (!error && data) {
                    return data as StoreSettings;
                }
            } catch (err) {
                console.error('[useStoreSettings] Exception fetching store_settings:', err);
            }

            // Fallback default
            return {
                id: 1,
                store_id: storeId,
                store_name: 'Test Store Retail POS',
                address: '123 Mall Road, Lahore, Pakistan',
                phone: '042-111222333',
                alt_phone: '0300-1234567',
                email: 'support@teststore.pk',
                website: 'https://teststore.pk',
                header_text: 'Premium Retail POS Outlet',
                footer_text: 'Thank you for shopping with us!',
                exchange_policy: 'Exchanges accepted within 7 days with original sales invoice.',
                logo_url: null,
                store_logo_url: null,
                fbr_integration_enabled: true,
                fbr_pos_id: '189142',
                fbr_api_url: 'http://146.190.202.112:5060/api/fbr/submit-invoice',
                fbr_environment: 'sandbox',
                weekly_off_days: ['friday'],
            } as StoreSettings;
        },
        staleTime: 1000 * 60 * 2,
    });
};

export const useUpdateStoreSettings = () => {
    const queryClient = useQueryClient();
    const storeId = getActiveStoreId();

    return useMutation({
        mutationFn: async (settings: Partial<StoreSettings>) => {
            const { data: existing } = await supabase
                .from('store_settings')
                .select('id')
                .eq('store_id', storeId)
                .maybeSingle();

            let result = null;
            if (existing) {
                const { data, error } = await supabase
                    .from('store_settings')
                    .update(settings)
                    .eq('store_id', storeId)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await supabase
                    .from('store_settings')
                    .insert([{ ...settings, store_id: storeId }])
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store-settings', storeId] });
            toast.success('Store settings updated successfully');
        },
        onError: (error: any) => {
            toast.error('Failed to update settings: ' + error.message);
        },
    });
};
