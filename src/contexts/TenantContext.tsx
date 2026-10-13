import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise' | 'custom';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type FbrEnvironment = 'sandbox' | 'production';

export interface EnabledModules {
  fbr_integration?: boolean;
  daily_reconciliation?: boolean;
  treasury_accounts?: boolean;
  credit_sales?: boolean;
  online_store?: boolean;
  barcode_printing?: boolean;
  enabled_pages?: string[];
  [key: string]: any;
}

import { StoreLexicon, DEFAULT_RETAIL_LEXICON, CustomProductField, getArchetypeById } from '@/config/industryArchetypes';

export interface Store {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  city?: string | null;
  ntn_strn?: string | null;
  is_active: boolean;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at?: string | null;
  billing_cycle?: string | null;
  monthly_fee?: number | null;
  max_terminals?: number | null;
  max_products?: number | null;
  fbr_environment: FbrEnvironment;
  enabled_modules: EnabledModules;
  business_type?: string | null;
  owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

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
  fbr_environment: FbrEnvironment;
  weekly_off_days?: string[] | null;
  lexicon?: StoreLexicon | null;
  custom_product_fields?: CustomProductField[] | null;
}

interface TenantContextType {
  currentStore: Store | null;
  storeSettings: StoreSettings | null;
  lexicon: StoreLexicon;
  customProductFields: CustomProductField[];
  fbrEnvironment: FbrEnvironment;
  setFbrEnvironment: (env: FbrEnvironment) => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
  isPageEnabled: (pagePath: string) => boolean;
  subscriptionStatus: SubscriptionStatus;
  isSuperAdmin: boolean;
  allStores: Store[];
  switchStore: (storeId: string) => Promise<void>;
  refreshStore: () => Promise<void>;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const DEMO_STORE_ID = '11111111-1111-1111-1111-111111111111';
const STORE_STORAGE_KEY = 'saas_active_store_id';

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load tenant state
  const loadTenant = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Check superadmin role
      let superAdmin = false;
      let userStoreId: string | null = null;

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, store_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          superAdmin = profile.role === 'superadmin' || user.email === 'superadmin@saaspos.pk';
          userStoreId = profile.store_id;
        }
      }
      setIsSuperAdmin(superAdmin);

      // 2. Fetch all stores (if superadmin) or active stores
      const { data: storesList } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      const stores = (storesList as Store[]) || [];
      setAllStores(stores);

      // 3. Determine active store ID
      let targetStoreId: string = DEMO_STORE_ID;
      const storedId = localStorage.getItem(STORE_STORAGE_KEY);

      if (superAdmin && storedId && stores.some(s => s.id === storedId)) {
        // Superadmin chosen store via switcher
        targetStoreId = storedId;
      } else if (userStoreId) {
        // Normal user bound to their profile store
        targetStoreId = userStoreId;
      } else if (storedId && stores.some(s => s.id === storedId)) {
        targetStoreId = storedId;
      } else if (stores.length > 0) {
        const match = stores.find(s => s.id === DEMO_STORE_ID) || stores[0];
        targetStoreId = match.id;
      }

      // 4. Fetch the selected store
      const { data: activeStoreData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', targetStoreId)
        .maybeSingle();

      const activeStore = (activeStoreData as Store) || null;
      setCurrentStore(activeStore);
      if (activeStore) {
        localStorage.setItem(STORE_STORAGE_KEY, activeStore.id);
      }

      // 5. Fetch store settings for this store
      if (targetStoreId) {
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('*')
          .eq('store_id', targetStoreId)
          .maybeSingle();

        setStoreSettings((settingsData as StoreSettings) || null);
      }
    } catch (err) {
      console.error('[TenantContext] Error loading tenant state:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  // Switch active store (Superadmin or God mode)
  const switchStore = async (storeId: string) => {
    localStorage.setItem(STORE_STORAGE_KEY, storeId);
    await loadTenant();
    toast.success('Switched active store context');
  };

  // Toggle FBR Environment between Sandbox and Production
  const setFbrEnvironment = async (env: FbrEnvironment) => {
    if (!currentStore) return;

    try {
      // 1. Update stores table
      const { error: storeErr } = await supabase
        .from('stores')
        .update({ fbr_environment: env, updated_at: new Date().toISOString() })
        .eq('id', currentStore.id);

      if (storeErr) throw storeErr;

      // 2. Update store_settings table
      const { error: settingsErr } = await supabase
        .from('store_settings')
        .update({ fbr_environment: env, updated_at: new Date().toISOString() })
        .eq('store_id', currentStore.id);

      if (settingsErr) throw settingsErr;

      // 3. Update local state
      setCurrentStore(prev => (prev ? { ...prev, fbr_environment: env } : null));
      setStoreSettings(prev => (prev ? { ...prev, fbr_environment: env } : null));

      toast.success(
        env === 'sandbox'
          ? '🧪 Switched to FBR Sandbox Mode (Test Invoices)'
          : '🟢 Switched to FBR Live Production Mode'
      );
    } catch (err: any) {
      console.error('Failed to change FBR environment:', err);
      toast.error('Failed to update FBR environment: ' + (err.message || 'Unknown error'));
      throw err;
    }
  };

  // Check if a specific module is enabled
  const isModuleEnabled = useCallback(
    (moduleKey: string): boolean => {
      if (!currentStore) return true; // Default fallback
      if (isSuperAdmin) return true; // Superadmin has access to all modules

      // Check store's enabled_modules
      if (currentStore.enabled_modules && typeof currentStore.enabled_modules[moduleKey] === 'boolean') {
        return !!currentStore.enabled_modules[moduleKey];
      }

      // Default true for standard core modules
      return true;
    },
    [currentStore, isSuperAdmin]
  );

  // Check if a specific page/route is enabled for current tenant
  const isPageEnabled = useCallback(
    (pagePath: string): boolean => {
      if (!currentStore) return true;
      if (isSuperAdmin) return true; // Superadmin has platform-wide god-mode access

      // Hard FBR disengagement check: If fbr_integration is disabled, FBR page is always blocked
      if (pagePath === '/setup/fbr' && currentStore.enabled_modules?.fbr_integration === false) {
        return false;
      }

      // Root dashboard is always accessible to all tenant users
      if (pagePath === '/' || pagePath === '') return true;

      // 1. If store has explicit enabled_pages array, check it
      const enabledPages = currentStore.enabled_modules?.enabled_pages;
      if (Array.isArray(enabledPages) && enabledPages.length > 0) {
        return enabledPages.includes(pagePath);
      }

      // 2. Backwards-compatible fallback to coarse module flags
      if (pagePath.startsWith('/online-store') && currentStore.enabled_modules?.online_store === false) {
        return false;
      }
      if (pagePath.startsWith('/order-book') && currentStore.enabled_modules?.online_store === false) {
        return false;
      }
      if (pagePath.startsWith('/reconciliation') && currentStore.enabled_modules?.daily_reconciliation === false) {
        return false;
      }
      if (pagePath === '/pos/pending-payments' && currentStore.enabled_modules?.credit_sales === false) {
        return false;
      }
      if ((pagePath === '/barcodes' || pagePath === '/utilities/custom-labels') && currentStore.enabled_modules?.barcode_printing === false) {
        return false;
      }
      if (pagePath === '/accounts' && currentStore.enabled_modules?.treasury_accounts === false) {
        return false;
      }

      return true;
    },
    [currentStore, isSuperAdmin]
  );

  const lexicon: StoreLexicon = useMemo(() => {
    if (storeSettings?.lexicon) {
      return {
        ...DEFAULT_RETAIL_LEXICON,
        ...storeSettings.lexicon
      };
    }
    // Backward compatibility for existing fabric demo store
    if (currentStore?.slug === 'teststore' || currentStore?.business_type === 'fabrics') {
      return {
        item_singular: "Suit",
        item_plural: "Suits",
        primary_unit: "suits",
        secondary_metric_name: "Meters",
        secondary_metric_symbol: "m",
        enable_secondary_metric: true,
        allow_fractional_qty: false
      };
    }
    return DEFAULT_RETAIL_LEXICON;
  }, [storeSettings?.lexicon, currentStore?.slug, currentStore?.business_type]);

  const customProductFields: CustomProductField[] = useMemo(() => {
    if (storeSettings?.custom_product_fields && Array.isArray(storeSettings.custom_product_fields) && storeSettings.custom_product_fields.length > 0) {
      return storeSettings.custom_product_fields;
    }
    const archetype = getArchetypeById(currentStore?.business_type);
    return archetype.defaultCustomFields || [];
  }, [storeSettings?.custom_product_fields, currentStore?.business_type]);

  const value: TenantContextType = {
    currentStore,
    storeSettings,
    lexicon,
    customProductFields,
    fbrEnvironment: currentStore?.fbr_environment || storeSettings?.fbr_environment || 'sandbox',
    setFbrEnvironment,
    isModuleEnabled,
    isPageEnabled,
    subscriptionStatus: currentStore?.subscription_status || 'active',
    isSuperAdmin,
    allStores,
    switchStore,
    refreshStore: loadTenant,
    loading,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
