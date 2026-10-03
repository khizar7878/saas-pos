import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, Store, SubscriptionTier, SubscriptionStatus, FbrEnvironment } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
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
  Sliders
} from 'lucide-react';
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

export default function Superadmin() {
  const { currentStore, switchStore, isSuperAdmin, refreshStore } = useTenant();
  const { user } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fbrFilter, setFbrFilter] = useState<string>('all');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // New Store Form State
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState('Lahore');
  const [newNtn, setNewNtn] = useState('');
  const [newTier, setNewTier] = useState<SubscriptionTier>('professional');
  const [newFbrEnv, setNewFbrEnv] = useState<FbrEnvironment>('sandbox');
  const [newPosId, setNewPosId] = useState('189142');
  const [newModules, setNewModules] = useState({
    fbr_integration: true,
    daily_reconciliation: true,
    treasury_accounts: true,
    credit_sales: true,
    barcode_printing: true,
    online_store: false,
  });

  const [submitting, setSubmitting] = useState(false);

  // Load all stores
  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStores((data as Store[]) || []);
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

  // Create new tenant store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) {
      toast.error('Store Name and URL Slug are required');
      return;
    }

    try {
      setSubmitting(true);
      const newStoreId = crypto.randomUUID();

      // 1. Insert into stores
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .insert([
          {
            id: newStoreId,
            name: newName.trim(),
            slug: newSlug.trim().toLowerCase(),
            contact_email: newOwnerEmail.trim() || null,
            phone: newPhone.trim() || null,
            city: newCity.trim() || null,
            ntn_strn: newNtn.trim() || null,
            subscription_tier: newTier,
            subscription_status: 'active',
            fbr_environment: newFbrEnv,
            enabled_modules: newModules,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (storeErr) throw storeErr;

      // 2. Insert store settings
      const { error: settingsErr } = await supabase
        .from('store_settings')
        .insert([
          {
            store_id: newStoreId,
            store_name: newName.trim(),
            phone: newPhone.trim() || null,
            email: newOwnerEmail.trim() || null,
            fbr_integration_enabled: newModules.fbr_integration,
            fbr_pos_id: newPosId.trim() || '189142',
            fbr_api_url: 'http://146.190.202.112:5060/api/fbr/submit-invoice',
            fbr_environment: newFbrEnv,
            weekly_off_days: ['friday'],
          },
        ]);

      if (settingsErr) throw settingsErr;

      // 3. Initialize Sequences
      await supabase.from('sequences').insert([
        { id: 'sale', store_id: newStoreId, current_value: 0, prefix: 'AK' },
        { id: 'return', store_id: newStoreId, current_value: 0, prefix: 'RET' },
        { id: 'credit_sale', store_id: newStoreId, current_value: 0, prefix: 'CS-' },
      ]);

      toast.success(`Store "${newName}" provisioned successfully!`);
      setCreateModalOpen(false);
      resetNewStoreForm();
      await fetchStores();
      await refreshStore();
    } catch (err: any) {
      console.error('Failed to create store:', err);
      toast.error('Failed to create store: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewStoreForm = () => {
    setNewName('');
    setNewSlug('');
    setNewOwnerEmail('');
    setNewPhone('');
    setNewCity('Lahore');
    setNewNtn('');
    setNewTier('professional');
    setNewFbrEnv('sandbox');
    setNewPosId('189142');
    setNewModules({
      fbr_integration: true,
      daily_reconciliation: true,
      treasury_accounts: true,
      credit_sales: true,
      barcode_printing: true,
      online_store: false,
    });
  };

  // Toggle FBR mode for a store directly from table
  const handleToggleFbr = async (store: Store) => {
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
  const handleToggleStatus = async (store: Store) => {
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
      const { error } = await supabase
        .from('stores')
        .update({
          name: selectedStore.name,
          subscription_tier: selectedStore.subscription_tier,
          subscription_status: selectedStore.subscription_status,
          fbr_environment: selectedStore.fbr_environment,
          enabled_modules: selectedStore.enabled_modules,
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
            onClick={() => setCreateModalOpen(true)}
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
                            <div className="text-xs text-muted-foreground font-mono">
                              /{store.slug}
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
                      </TableCell>

                      {/* Modules Badges */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {store.enabled_modules?.fbr_integration && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
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
                          onClick={() => {
                            setSelectedStore(store);
                            setEditModalOpen(true);
                          }}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Owner / Contact Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="owner@royalsilks.pk"
                  value={newOwnerEmail}
                  onChange={e => setNewOwnerEmail(e.target.value)}
                />
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
                <Select value={newTier} onValueChange={(val: any) => setNewTier(val)}>
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
            </div>

            {/* Modular Feature Flags */}
            <div className="pt-2 border-t space-y-3">
              <Label className="font-semibold text-sm">Enabled Modules & Feature Flags</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.fbr_integration}
                    onChange={e => setNewModules({ ...newModules, fbr_integration: e.target.checked })}
                    className="rounded"
                  />
                  <span>FBR Integration</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.daily_reconciliation}
                    onChange={e => setNewModules({ ...newModules, daily_reconciliation: e.target.checked })}
                    className="rounded"
                  />
                  <span>Daily Reconciliation</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.treasury_accounts}
                    onChange={e => setNewModules({ ...newModules, treasury_accounts: e.target.checked })}
                    className="rounded"
                  />
                  <span>Treasury Accounts</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.credit_sales}
                    onChange={e => setNewModules({ ...newModules, credit_sales: e.target.checked })}
                    className="rounded"
                  />
                  <span>Credit Sales / Khata</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.barcode_printing}
                    onChange={e => setNewModules({ ...newModules, barcode_printing: e.target.checked })}
                    className="rounded"
                  />
                  <span>Barcode Printing</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer border p-2 rounded-lg hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={newModules.online_store}
                    onChange={e => setNewModules({ ...newModules, online_store: e.target.checked })}
                    className="rounded"
                  />
                  <span>Online Store</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {submitting ? 'Provisioning...' : 'Provision Store'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Store Modal */}
      {selectedStore && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-xl">
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
                    onValueChange={(val: any) =>
                      setSelectedStore({ ...selectedStore, subscription_tier: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
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

              {/* Module Toggles */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Enabled Modules</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['fbr_integration', 'daily_reconciliation', 'treasury_accounts', 'credit_sales', 'barcode_printing', 'online_store'].map(
                    modKey => (
                      <label
                        key={modKey}
                        className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedStore.enabled_modules?.[modKey]}
                          onChange={e =>
                            setSelectedStore({
                              ...selectedStore,
                              enabled_modules: {
                                ...selectedStore.enabled_modules,
                                [modKey]: e.target.checked,
                              },
                            })
                          }
                        />
                        <span className="capitalize">{modKey.replace(/_/g, ' ')}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
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
