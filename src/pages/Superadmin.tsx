import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, type Store as TenantStore, type SubscriptionTier, type SubscriptionStatus, type FbrEnvironment } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
  Store,
  Users,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings2,
  ExternalLink,
  Crown,
  Activity,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Server,
  Zap,
  Globe,
  Sliders,
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  ShoppingCart,
  Package,
  BarChart3,
  Scale,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  RotateCcw
} from "lucide-react";
import { GRANULAR_SECTIONS, ALL_PAGE_PATHS, TIER_PRESETS } from '@/config/granularModules';
import { INDUSTRY_ARCHETYPES, getArchetypeById } from '@/config/industryArchetypes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface GranularPermissionsEditorProps {
  fbrEnabled: boolean;
  onFbrChange: (enabled: boolean) => void;
  enabledPages: string[];
  onEnabledPagesChange: (pages: string[]) => void;
  tier: SubscriptionTier;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  pos: <ShoppingCart className="w-4 h-4 text-emerald-500" />,
  inventory: <Package className="w-4 h-4 text-blue-500" />,
  reports: <BarChart3 className="w-4 h-4 text-purple-500" />,
  accounting: <Scale className="w-4 h-4 text-amber-500" />,
  fbr: <Building2 className="w-4 h-4 text-red-500" />,
  online_store: <Globe className="w-4 h-4 text-indigo-500" />,
  utilities: <Settings className="w-4 h-4 text-slate-500" />,
};

function GranularPermissionsEditor({
  fbrEnabled,
  onFbrChange,
  enabledPages,
  onEnabledPagesChange,
  tier,
}: GranularPermissionsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pos: true,
    inventory: true,
    reports: false,
    accounting: true,
    fbr: true,
    online_store: false,
    utilities: true,
  });

  const toggleAllExpanded = () => {
    const allExpanded = Object.values(expandedSections).every(Boolean);
    const nextState: Record<string, boolean> = {};
    GRANULAR_SECTIONS.forEach(s => {
      nextState[s.id] = !allExpanded;
    });
    setExpandedSections(nextState);
  };

  return (
    <div className="space-y-4 pt-3 border-t">
      {/* 1. Master FBR Disengagement Switch */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          fbrEnabled
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                fbrEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">FBR Real-time Fiscalization</h4>
                <Badge
                  className={
                    fbrEnabled
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-400/40 text-[11px]'
                      : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/40 text-[11px]'
                  }
                >
                  {fbrEnabled ? '🟢 Service Engaged' : '🚫 100% Disengaged'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {fbrEnabled
                  ? 'FBR IRIS service is connected. Checkouts generate fiscal numbers and receipts print verification QR codes (or sandbox training markers).'
                  : 'FBR service is completely bypassed. Checkout transactions execute locally with zero network delay, and thermal receipts print standard retail bills without FBR QR codes or test watermarks.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Switch
              checked={fbrEnabled}
              onCheckedChange={checked => {
                onFbrChange(checked);
                if (checked && !enabledPages.includes('/setup/fbr')) {
                  onEnabledPagesChange([...enabledPages, '/setup/fbr']);
                } else if (!checked && enabledPages.includes('/setup/fbr')) {
                  onEnabledPagesChange(enabledPages.filter(p => p !== '/setup/fbr'));
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Granular Page Matrix Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Granular Page Permissions
          </span>
          <Badge variant="outline" className="text-xs font-mono">
            {enabledPages.length} / {ALL_PAGE_PATHS.length} Pages Active
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={toggleAllExpanded}
          >
            {Object.values(expandedSections).every(Boolean) ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              onEnabledPagesChange([...ALL_PAGE_PATHS]);
              if (!fbrEnabled) onFbrChange(true);
            }}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Enable All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 text-indigo-600 dark:text-indigo-400"
            onClick={() => {
              const preset = TIER_PRESETS[tier] || TIER_PRESETS.professional;
              onEnabledPagesChange([...preset.pages]);
              onFbrChange(preset.fbr);
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to {tier.charAt(0).toUpperCase() + tier.slice(1)} Preset
          </Button>
        </div>
      </div>

      {/* 3. Granular Sections Accordion Cards */}
      <div className="space-y-3">
        {GRANULAR_SECTIONS.map(section => {
          const sectionPagePaths = section.pages.map(p => p.path);
          const enabledInSection = sectionPagePaths.filter(p => enabledPages.includes(p));
          const allSectionActive =
            sectionPagePaths.length > 0 && enabledInSection.length === sectionPagePaths.length;
          const isExpanded = expandedSections[section.id] ?? true;

          const toggleSection = (enable: boolean) => {
            let nextPages: string[];
            if (enable) {
              const toAdd = sectionPagePaths.filter(p => !enabledPages.includes(p));
              nextPages = [...enabledPages, ...toAdd];
              if (section.id === 'fbr' && !fbrEnabled) {
                onFbrChange(true);
              }
            } else {
              nextPages = enabledPages.filter(p => !sectionPagePaths.includes(p));
            }
            onEnabledPagesChange(nextPages);
          };

          return (
            <div key={section.id} className="border rounded-xl bg-card overflow-hidden shadow-xs">
              <div className="p-3 bg-muted/40 flex items-center justify-between gap-3 border-b">
                <div
                  className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0"
                  onClick={() =>
                    setExpandedSections(prev => ({ ...prev, [section.id]: !isExpanded }))
                  }
                >
                  <div className="p-1.5 rounded-md bg-background border shadow-xs shrink-0">
                    {SECTION_ICONS[section.id] || <Settings className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{section.title}</span>
                      <Badge
                        variant={
                          allSectionActive ? 'default' : enabledInSection.length > 0 ? 'secondary' : 'outline'
                        }
                        className="text-[10px] h-4 px-1.5 font-mono shrink-0"
                      >
                        {enabledInSection.length} / {sectionPagePaths.length}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleSection(!allSectionActive)}
                  >
                    {allSectionActive ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() =>
                      setExpandedSections(prev => ({ ...prev, [section.id]: !isExpanded }))
                    }
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-background/50">
                  {section.pages.map(page => {
                    const isChecked = enabledPages.includes(page.path);
                    const isFbrLocked = page.path === '/setup/fbr' && !fbrEnabled;

                    return (
                      <div
                        key={page.path}
                        onClick={() => {
                          if (isFbrLocked) return;
                          if (isChecked) {
                            onEnabledPagesChange(enabledPages.filter(p => p !== page.path));
                          } else {
                            onEnabledPagesChange([...enabledPages, page.path]);
                          }
                        }}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-950/30'
                            : 'border-border/60 hover:bg-muted/40'
                        } ${isFbrLocked ? 'opacity-60 cursor-not-allowed bg-muted/20' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isFbrLocked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">{page.name}</span>
                            {page.isCore && (
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-800 px-1 py-0.2 rounded text-muted-foreground font-semibold">
                                CORE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {isFbrLocked ? 'Disabled by Master FBR Switch' : page.description}
                          </p>
                          <code className="text-[10px] text-muted-foreground/70 font-mono">
                            {page.path}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Superadmin() {
  const navigate = useNavigate();
  const { currentStore, switchStore, isSuperAdmin, refreshStore } = useTenant();
  const { user } = useAuth();

  const [stores, setStores] = useState<TenantStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fbrFilter, setFbrFilter] = useState<string>('all');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<TenantStore | null>(null);

  // New Store Form State
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState('Lahore');
  const [newNtn, setNewNtn] = useState('');
  const [newTier, setNewTier] = useState<SubscriptionTier>('professional');
  const [newFbrEnv, setNewFbrEnv] = useState<FbrEnvironment>('sandbox');
  const [newPosId, setNewPosId] = useState('189142');
  const [newBusinessType, setNewBusinessType] = useState('general_retail');

  // Granular page permissions and FBR master state for New Store
  const [newFbrEnabled, setNewFbrEnabled] = useState(TIER_PRESETS.professional.fbr);
  const [newEnabledPages, setNewEnabledPages] = useState<string[]>([...TIER_PRESETS.professional.pages]);

  // Granular page permissions and FBR master state for Editing Store
  const [editFbrEnabled, setEditFbrEnabled] = useState(true);
  const [editEnabledPages, setEditEnabledPages] = useState<string[]>([]);

  // Auto-sync preset when selecting subscription tier in creation modal
  const handleNewTierChange = (tier: SubscriptionTier) => {
    setNewTier(tier);
    const preset = TIER_PRESETS[tier];
    if (preset) {
      setNewFbrEnabled(preset.fbr);
      setNewEnabledPages([...preset.pages]);
    }
  };

  // Open Edit Modal with full granular resolution
  const openEditModal = (store: TenantStore) => {
    setSelectedStore(store);
    const isFbr = store.enabled_modules?.fbr_integration !== false;
    setEditFbrEnabled(isFbr);
    const existingPages = store.enabled_modules?.enabled_pages;
    const initialPages =
      Array.isArray(existingPages) && existingPages.length > 0
        ? [...existingPages]
        : [...(TIER_PRESETS[store.subscription_tier]?.pages || ALL_PAGE_PATHS)];
    setEditEnabledPages(initialPages);
    setEditModalOpen(true);
  };

  // Auto-sync preset when selecting subscription tier in edit modal
  const handleEditTierChange = (tier: SubscriptionTier) => {
    if (!selectedStore) return;
    setSelectedStore({ ...selectedStore, subscription_tier: tier });
    const preset = TIER_PRESETS[tier];
    if (preset) {
      setEditFbrEnabled(preset.fbr);
      setEditEnabledPages([...preset.pages]);
    }
  };

  // Success dialog state for freshly provisioned tenant & owner credentials
  const [createdSuccessData, setCreatedSuccessData] = useState<{
    storeName: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    storeId: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Generate secure temporary password
  const generateRandomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%';
    let pw = '';
    pw += upper.charAt(Math.floor(Math.random() * upper.length));
    pw += lower.charAt(Math.floor(Math.random() * lower.length));
    pw += digits.charAt(Math.floor(Math.random() * digits.length));
    pw += symbols.charAt(Math.floor(Math.random() * symbols.length));
    const allChars = upper + lower + digits + symbols;
    for (let i = 0; i < 6; i++) {
      pw += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    return pw;
  };

  // Load all stores
  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStores((data as TenantStore[]) || []);
    } catch (err: any) {
      console.error('Failed to load stores:', err);
      toast.error('Failed to load stores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // Filtered stores
  const filteredStores = stores.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.contact_email && s.contact_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || s.subscription_status === statusFilter;
    const matchesFbr = fbrFilter === 'all' || s.fbr_environment === fbrFilter;

    return matchesSearch && matchesStatus && matchesFbr;
  });

  // Auto-slugify
  const handleNameChange = (name: string) => {
    setNewName(name);
    if (!newSlug || newSlug === newName.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
      setNewSlug(name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
    }
  };

  // Create new tenant store with complete owner auth provisioning
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) {
      toast.error('Store Name and URL Slug are required');
      return;
    }
    if (!newOwnerEmail.trim()) {
      toast.error('Owner Email is required to create client login credentials');
      return;
    }
    if (!newOwnerPassword.trim()) {
      toast.error('Initial Owner Password is required');
      return;
    }

    try {
      setSubmitting(true);
      const ownerName = newOwnerName.trim() || `${newName.trim()} Owner`;
      const ownerEmail = newOwnerEmail.trim().toLowerCase();
      const ownerPassword = newOwnerPassword.trim();

      const enabledModules = {
        fbr_integration: newFbrEnabled,
        daily_reconciliation: newEnabledPages.some(p => p.startsWith('/reconciliation')),
        treasury_accounts: newEnabledPages.includes('/accounts'),
        credit_sales: newEnabledPages.includes('/pos/pending-payments'),
        barcode_printing: newEnabledPages.includes('/barcodes') || newEnabledPages.includes('/utilities/custom-labels'),
        online_store: newEnabledPages.some(p => p.startsWith('/online-store') || p.startsWith('/order-book')),
        enabled_pages: newEnabledPages,
      };

      // Call Atomic Provisioning RPC
      const { data: res, error: rpcErr } = await supabase.rpc('provision_tenant_store', {
        p_store_name: newName.trim(),
        p_slug: newSlug.trim().toLowerCase(),
        p_owner_name: ownerName,
        p_owner_email: ownerEmail,
        p_owner_password: ownerPassword,
        p_phone: newPhone.trim() || null,
        p_city: newCity.trim() || 'Lahore',
        p_ntn: newNtn.trim() || null,
        p_subscription_tier: newTier,
        p_fbr_environment: newFbrEnv,
        p_fbr_pos_id: newPosId.trim() || '189142',
        p_enabled_modules: enabledModules,
        p_business_type: newBusinessType,
      });

      if (rpcErr) throw rpcErr;

      toast.success(`Store "${newName}" & Owner credentials provisioned successfully!`);
      setCreateModalOpen(false);

      // Open Success Credentials Modal
      setCreatedSuccessData({
        storeName: newName.trim(),
        slug: newSlug.trim().toLowerCase(),
        ownerName,
        ownerEmail,
        ownerPassword,
        storeId: res?.store_id || '',
      });

      resetNewStoreForm();
      await fetchStores();
      await refreshStore();
    } catch (err: any) {
      console.error('Failed to create store:', err);
      toast.error('Failed to provision store: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewStoreForm = () => {
    setNewName('');
    setNewSlug('');
    setNewOwnerName('');
    setNewOwnerEmail('');
    setNewOwnerPassword('');
    setShowPassword(false);
    setNewPhone('');
    setNewCity('Lahore');
    setNewNtn('');
    setNewTier('professional');
    setNewFbrEnv('sandbox');
    setNewPosId('189142');
    setNewBusinessType('general_retail');
    setNewFbrEnabled(TIER_PRESETS.professional.fbr);
    setNewEnabledPages([...TIER_PRESETS.professional.pages]);
  };

  // Toggle FBR mode for a store directly from table
  const handleToggleFbr = async (store: TenantStore) => {
    const nextEnv: FbrEnvironment = store.fbr_environment === 'production' ? 'sandbox' : 'production';
    try {
      const { error: storeErr } = await supabase
        .from('stores')
        .update({ fbr_environment: nextEnv })
        .eq('id', store.id);

      if (storeErr) throw storeErr;

      await supabase
        .from('store_settings')
        .update({ fbr_environment: nextEnv })
        .eq('store_id', store.id);

      setStores(prev => prev.map(s => (s.id === store.id ? { ...s, fbr_environment: nextEnv } : s)));
      toast.success(
        `Updated ${store.name} to ${nextEnv === 'production' ? '🟢 Live Production' : '🧪 Sandbox'}`
      );
      if (currentStore?.id === store.id) {
        await refreshStore();
      }
    } catch (err: any) {
      toast.error('Failed to switch FBR mode: ' + err.message);
    }
  };

  // Toggle active/suspended
  const handleToggleStatus = async (store: TenantStore) => {
    const nextStatus: SubscriptionStatus = store.subscription_status === 'active' ? 'suspended' : 'active';
    try {
      const { error } = await supabase
        .from('stores')
        .update({ subscription_status: nextStatus, is_active: nextStatus === 'active' })
        .eq('id', store.id);

      if (error) throw error;

      setStores(prev =>
        prev.map(s =>
          s.id === store.id ? { ...s, subscription_status: nextStatus, is_active: nextStatus === 'active' } : s
        )
      );
      toast.success(`Store status changed to ${nextStatus}`);
    } catch (err: any) {
      toast.error('Failed to update store status: ' + err.message);
    }
  };

  // Save Edit Store
  const handleSaveEdit = async () => {
    if (!selectedStore) return;
    try {
      setSubmitting(true);
      const enabledModules = {
        ...selectedStore.enabled_modules,
        fbr_integration: editFbrEnabled,
        daily_reconciliation: editEnabledPages.some(p => p.startsWith('/reconciliation')),
        treasury_accounts: editEnabledPages.includes('/accounts'),
        credit_sales: editEnabledPages.includes('/pos/pending-payments'),
        barcode_printing: editEnabledPages.includes('/barcodes') || editEnabledPages.includes('/utilities/custom-labels'),
        online_store: editEnabledPages.some(p => p.startsWith('/online-store') || p.startsWith('/order-book')),
        enabled_pages: editEnabledPages,
      };

      const { error } = await supabase
        .from('stores')
        .update({
          name: selectedStore.name,
          subscription_tier: selectedStore.subscription_tier,
          subscription_status: selectedStore.subscription_status,
          fbr_environment: selectedStore.fbr_environment,
          enabled_modules: enabledModules,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedStore.id);

      if (error) throw error;

      toast.success('Store settings saved');
      setEditModalOpen(false);
      await fetchStores();
      if (currentStore?.id === selectedStore.id) {
        await refreshStore();
      }
    } catch (err: any) {
      toast.error('Failed to save store: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const activeCount = stores.filter(s => s.subscription_status === 'active').length;
  const trialCount = stores.filter(s => s.subscription_status === 'trialing').length;
  const prodFbrCount = stores.filter(s => s.fbr_environment === 'production').length;

  return (
    <div className="h-full overflow-auto p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1">
              <Crown className="w-3.5 h-3.5" /> Platform Superadmin Plane
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Multi-Tenant Architecture
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">SaaS POS Control Plane</h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Oversee and govern all tenant stores, manage subscription plans, toggle modular feature flags,
            and monitor live FBR telemetry across the entire platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              if (!newOwnerPassword) setNewOwnerPassword(generateRandomPassword());
              setCreateModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg gap-2"
          >
            <Plus className="w-4 h-4" /> Onboard New Store
          </Button>
          <Button
            variant="outline"
            onClick={fetchStores}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stores</CardTitle>
            <Building2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Managed retail businesses</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{trialCount} trialing clients</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FBR Live Production</CardTitle>
            <Server className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{prodFbrCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stores.length - prodFbrCount} in Sandbox test mode
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Context</CardTitle>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold truncate text-foreground">
              {currentStore?.name || 'Test Store'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              ID: {currentStore?.slug || 'teststore'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Stores Management */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">Client Stores & Subscriptions</CardTitle>
              <CardDescription>
                Partitioned tenant workspaces with dedicated settings, inventories, and accounting
              </CardDescription>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search stores, slug, city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select value={fbrFilter} onValueChange={setFbrFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="FBR Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All FBR</SelectItem>
                  <SelectItem value="sandbox">🧪 Sandbox</SelectItem>
                  <SelectItem value="production">🟢 Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Store Name / Slug</TableHead>
                <TableHead>Location & Contact</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>FBR Mode</TableHead>
                <TableHead>Modules Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No stores found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores.map(store => {
                  const isCurrent = currentStore?.id === store.id;
                  const isSandbox = store.fbr_environment === 'sandbox';

                  return (
                    <TableRow key={store.id} className={isCurrent ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}>
                      {/* Name & Slug */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {store.name}
                              {isCurrent && (
                                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                                  Current View
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                              <span>/{store.slug}</span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-sans">
                                {getArchetypeById(store.business_type).name.split(' ')[0]}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact & Location */}
                      <TableCell>
                        <div className="text-sm">{store.city || 'Pakistan'}</div>
                        <div className="text-xs text-muted-foreground">
                          {store.contact_email || store.phone || 'No contact'}
                        </div>
                      </TableCell>

                      {/* Subscription Tier */}
                      <TableCell>
                        <Badge variant="outline" className="capitalize font-medium">
                          {store.subscription_tier}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          className={
                            store.subscription_status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : store.subscription_status === 'trialing'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                          }
                        >
                          {store.subscription_status}
                        </Badge>
                      </TableCell>

                      {/* FBR Mode Toggle */}
                      <TableCell>
                        {store.enabled_modules?.fbr_integration === false ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[11px] font-normal"
                          >
                            🚫 Disengaged
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleFbr(store)}
                            className={`gap-1.5 h-7 text-xs font-medium border ${
                              isSandbox
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {isSandbox ? '🧪 Sandbox' : '🟢 Production'}
                          </Button>
                        )}
                      </TableCell>

                      {/* Modules Badges */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.isArray(store.enabled_modules?.enabled_pages) && (
                            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                              {store.enabled_modules.enabled_pages.length} pages
                            </Badge>
                          )}
                          {store.enabled_modules?.fbr_integration !== false && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                              FBR
                            </span>
                          )}
                          {store.enabled_modules?.daily_reconciliation && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                              Reconciliation
                            </span>
                          )}
                          {store.enabled_modules?.treasury_accounts && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                              Treasury
                            </span>
                          )}
                          {store.enabled_modules?.credit_sales && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                              Credit
                            </span>
                          )}
                          {store.enabled_modules?.barcode_printing && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                              Barcodes
                            </span>
                          )}
                          {store.enabled_modules?.online_store && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                              Online
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Action Buttons */}
                      <TableCell className="text-right space-x-2">
                        {/* God Mode Switcher */}
                        <Button
                          size="sm"
                          variant={isCurrent ? 'secondary' : 'default'}
                          onClick={() => switchStore(store.id)}
                          className="h-8 text-xs gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {isCurrent ? 'Viewing' : 'Switch To Store'}
                        </Button>

                        {/* Edit Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(store)}
                          className="h-8 text-xs"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboard New Store Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" /> Onboard New Tenant Store
            </DialogTitle>
            <DialogDescription>
              Provision a brand-new partitioned store environment with isolated settings, inventory, and till ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStore} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Industry Archetype Selector */}
              <div className="space-y-1.5 md:col-span-2 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                <Label htmlFor="business-type" className="flex items-center gap-1.5 font-semibold text-xs text-indigo-950 dark:text-indigo-200">
                  <Store className="w-3.5 h-3.5 text-indigo-600" /> Industry Archetype & Retail Model
                </Label>
                <Select value={newBusinessType} onValueChange={setNewBusinessType}>
                  <SelectTrigger id="business-type" className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_ARCHETYPES.map((arch) => (
                      <SelectItem key={arch.id} value={arch.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{arch.name}</span>
                          <Badge variant="outline" className="text-[10px] ml-1">{arch.badge}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {getArchetypeById(newBusinessType).description} • Unit: <strong>{getArchetypeById(newBusinessType).defaultLexicon.primary_unit}</strong>
                  {getArchetypeById(newBusinessType).defaultLexicon.enable_secondary_metric && (
                    <> • Secondary Metric: <strong>{getArchetypeById(newBusinessType).defaultLexicon.secondary_metric_name}</strong></>
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-name">Store Name *</Label>
                <Input
                  id="store-name"
                  placeholder="e.g. Royal Silks & Fabrics"
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-slug">URL Slug *</Label>
                <Input
                  id="store-slug"
                  placeholder="e.g. royal-silks"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                  required
                />
              </div>

              {/* Owner Credentials Section */}
              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Owner Full Name *</Label>
                <Input
                  id="owner-name"
                  placeholder="e.g. Tariq Mahmood"
                  value={newOwnerName}
                  onChange={e => setNewOwnerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Owner Login Email *</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="owner@royalsilks.pk"
                  value={newOwnerEmail}
                  onChange={e => setNewOwnerEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="owner-password" className="text-xs font-semibold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" /> Initial Owner Password *
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewOwnerPassword(generateRandomPassword())}
                    className="h-6 text-[11px] text-indigo-600 hover:text-indigo-500 gap-1 px-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Password
                  </Button>
                </div>
                <div className="relative mt-1">
                  <Input
                    id="owner-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter or generate temporary password"
                    value={newOwnerPassword}
                    onChange={e => setNewOwnerPassword(e.target.value)}
                    required
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  This user will be granted the <strong>Store Owner</strong> role with full access to this store's POS, catalog, and khata.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Contact Phone</Label>
                <Input
                  id="phone"
                  placeholder="0300-1234567"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Lahore / Faisalabad / Karachi"
                  value={newCity}
                  onChange={e => setNewCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ntn">NTN / STRN</Label>
                <Input
                  id="ntn"
                  placeholder="1234567-8"
                  value={newNtn}
                  onChange={e => setNewNtn(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Subscription Tier</Label>
                <Select value={newTier} onValueChange={(val: any) => handleNewTierChange(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (Single Till)</SelectItem>
                    <SelectItem value="professional">Professional (Multi-Till & FBR)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Unlimited + Online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>FBR Initial Environment</Label>
                <Select value={newFbrEnv} onValueChange={(val: any) => setNewFbrEnv(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">🧪 Sandbox (Mock & Staff Training)</SelectItem>
                    <SelectItem value="production">🟢 Production (Live Iris Gateway)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pos-id">Initial POS ID</Label>
                <Input
                  id="pos-id"
                  placeholder="189142"
                  value={newPosId}
                  onChange={e => setNewPosId(e.target.value)}
                />
              </div>
            </div>

            {/* Granular Page & Feature Permissions */}
            <GranularPermissionsEditor
              fbrEnabled={newFbrEnabled}
              onFbrChange={setNewFbrEnabled}
              enabledPages={newEnabledPages}
              onEnabledPagesChange={setNewEnabledPages}
              tier={newTier}
            />

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {submitting ? 'Provisioning...' : 'Provision Store & Create Owner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Onboarding Success Dialog with Copyable Credentials */}
      <Dialog open={!!createdSuccessData} onOpenChange={(open) => !open && setCreatedSuccessData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" /> Store & Owner Account Ready!
            </DialogTitle>
            <DialogDescription>
              The new tenant store has been provisioned and the initial owner credentials have been created. Share these details with the client.
            </DialogDescription>
          </DialogHeader>

          {createdSuccessData && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Store Name:</span>
                  <span className="font-semibold text-xs">{createdSuccessData.storeName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Store URL Slug:</span>
                  <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                    {createdSuccessData.slug}
                  </code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Owner Name:</span>
                  <span className="text-xs font-medium">{createdSuccessData.ownerName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">Login Email:</span>
                  <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {createdSuccessData.ownerEmail}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground text-xs">Initial Password:</span>
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {createdSuccessData.ownerPassword}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => {
                    const credsText = `SaaS Retail POS Credentials:\nStore: ${createdSuccessData.storeName}\nLogin URL: ${window.location.origin}/auth\nEmail: ${createdSuccessData.ownerEmail}\nPassword: ${createdSuccessData.ownerPassword}`;
                    navigator.clipboard.writeText(credsText);
                    toast.success('Credentials copied to clipboard!');
                  }}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Client Credentials to Clipboard
                </Button>
                {createdSuccessData.storeId && (
                  <Button
                    type="button"
                    className="w-full text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                    onClick={async () => {
                      await switchStore(createdSuccessData.storeId);
                      setCreatedSuccessData(null);
                      navigate('/');
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Switch to Store Workspace Now
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreatedSuccessData(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Store Modal */}
      {selectedStore && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" /> Manage Store: {selectedStore.name}
              </DialogTitle>
              <DialogDescription>
                Configure subscription tier, lifecycle status, and feature flags for this tenant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label>Store Name</Label>
                <Input
                  value={selectedStore.name}
                  onChange={e => setSelectedStore({ ...selectedStore, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Subscription Tier</Label>
                  <Select
                    value={selectedStore.subscription_tier}
                    onValueChange={(val: any) => handleEditTierChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (Single Till)</SelectItem>
                      <SelectItem value="professional">Professional (Multi-Till & FBR)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (Unlimited + Online)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={selectedStore.subscription_status}
                    onValueChange={(val: any) =>
                      setSelectedStore({ ...selectedStore, subscription_status: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* FBR Mode in Edit */}
              <div className="space-y-1.5">
                <Label>FBR Fiscalization Mode</Label>
                <Select
                  value={selectedStore.fbr_environment}
                  onValueChange={(val: any) =>
                    setSelectedStore({ ...selectedStore, fbr_environment: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">🧪 Sandbox / Test Mode</SelectItem>
                    <SelectItem value="production">🟢 Live Production Gateway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Granular Page & Feature Permissions */}
              <GranularPermissionsEditor
                fbrEnabled={editFbrEnabled}
                onFbrChange={setEditFbrEnabled}
                enabledPages={editEnabledPages}
                onEnabledPagesChange={setEditEnabledPages}
                tier={selectedStore.subscription_tier}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
