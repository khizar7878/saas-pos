import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Send,
  Sliders,
  Save,
  RotateCw,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Copy,
  Check,
  QrCode,
  FileText,
  ShieldCheck,
  Zap,
  Loader2,
  TrendingUp,
  Receipt,
  ExternalLink,
  Cloud,
  Laptop,
} from "lucide-react";

import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { buildFBRInvoicePayload, submitToFBR } from "@/services/fbrService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FbrSettingsForm {
  fbr_integration_enabled: boolean;
  fbr_pos_id: string;
  fbr_api_url: string;
}

interface FiscalSale {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  payment_method: string;
  created_at: string;
  fbr_invoice_number: string | null;
  fbr_qr_code: string | null;
  status: string;
}

const CLOUD_GATEWAY_URL = "http://146.190.202.112:5060/api/fbr/submit-invoice";
const LOCAL_GATEWAY_URL = "http://127.0.0.1:5060/api/fbr/submit-invoice";

interface UpstreamFbrHealth {
  status: "online" | "unreachable" | "unknown";
  endpoint?: string;
  ip?: string;
  latency_ms?: number | null;
  error?: string | null;
}

interface NodeHealth {
  status: "checking" | "online" | "warning" | "offline" | "error";
  latency?: number;
  pos_id?: string;
  service?: string;
  timestamp?: string;
  message?: string;
  upstream_fbr?: UpstreamFbrHealth;
}

interface FbrStats {
  todayCount: number;
  todayAmount: number;
  totalFiscalized: number;
  totalSales: number;
  pendingCount: number;
}

const FbrDashboard = () => {
  const { data: settings, isLoading: settingsLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const { fbrEnvironment, setFbrEnvironment } = useTenant();

  // Dual Gateway Health state
  const [cloudHealth, setCloudHealth] = useState<NodeHealth>({ status: "checking" });
  const [localHealth, setLocalHealth] = useState<NodeHealth>({ status: "checking" });
  const [healthTesting, setHealthTesting] = useState(false);

  // Fiscal Data states
  const [stats, setStats] = useState<FbrStats>({
    todayCount: 0,
    todayAmount: 0,
    totalFiscalized: 0,
    totalSales: 0,
    pendingCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const [recentSales, setRecentSales] = useState<FiscalSale[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [pendingSales, setPendingSales] = useState<FiscalSale[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Search filter for recent submissions
  const [searchQuery, setSearchQuery] = useState("");

  // Submitting / Retry states
  const [processingSaleId, setProcessingSaleId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // QR Code preview modal
  const [qrModalSale, setQrModalSale] = useState<FiscalSale | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, setValue, watch, formState: { isDirty } } = useForm<FbrSettingsForm>();

  const currentApiUrl = watch("fbr_api_url");
  const isUsingLocalGateway = (currentApiUrl || settings?.fbr_api_url || "").includes("localhost") || (currentApiUrl || "").includes("127.0.0.1");

  // Reset form with DB settings
  useEffect(() => {
    if (settings) {
      reset({
        fbr_integration_enabled: settings.fbr_integration_enabled ?? true,
        fbr_pos_id: settings.fbr_pos_id || "189142",
        fbr_api_url: settings.fbr_api_url || CLOUD_GATEWAY_URL,
      });
    }
  }, [settings, reset]);

  // Ping Both Cloud and Local Gateways with upstream probe
  const pingAllGateways = async () => {
    setHealthTesting(true);

    // 1. Probe Cloud Gateway (via relative proxy with active upstream reachability test)
    try {
      const startCloud = performance.now();
      const res = await fetch("/api/fbr/health", { cache: "no-store", signal: AbortSignal.timeout(3500) });
      const duration = Math.round(performance.now() - startCloud);

      if (res.ok) {
        const data = await res.json();
        
        // Active non-destructive upstream probe to verify Droplet -> FBR reachability
        let upstreamHealth: UpstreamFbrHealth = { status: "checking" };
        try {
          const upstreamStart = performance.now();
          const probeRes = await fetch("/api/fbr/submit-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ USIN: "PROBE_PING", POSID: 189142, DateTime: new Date().toISOString(), Items: [] }),
            signal: AbortSignal.timeout(4000),
          });
          const upstreamDuration = Math.round(performance.now() - upstreamStart);
          const probeData = await probeRes.json();
          // If FBR responded (even with validation error 102), the upstream connection is ALIVE
          if (probeData?.Code || probeData?.raw?.Code || probeRes.status === 200 || probeRes.status === 400) {
            upstreamHealth = {
              status: "online",
              endpoint: "gw.fbr.gov.pk",
              latency_ms: upstreamDuration,
            };
          } else {
            upstreamHealth = {
              status: "unreachable",
              endpoint: "gw.fbr.gov.pk",
              error: probeData?.Response || "Invalid response from FBR",
            };
          }
        } catch (probeErr: any) {
          upstreamHealth = {
            status: "unreachable",
            endpoint: "gw.fbr.gov.pk",
            error: probeErr.name === 'TimeoutError' ? "Connection to FBR timed out (>4s)" : probeErr.message,
          };
        }

        setCloudHealth({
          status: upstreamHealth.status === "online" ? "online" : "warning",
          latency: duration,
          pos_id: data.pos_id || "189142",
          service: data.service || "fbr-ims-service",
          timestamp: data.timestamp,
          upstream_fbr: upstreamHealth,
        });
      } else {
        setCloudHealth({
          status: "error",
          latency: duration,
          message: `Cloud responded with HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setCloudHealth({
        status: "offline",
        message: err.name === 'TimeoutError' ? "Cloud proxy timed out (>3.5s)" : "Could not connect to cloud proxy",
      });
    }

    // 2. Probe Local Gateway (Try Vite proxy route only if on localhost, then direct 127.0.0.1 / localhost)
    try {
      const startLocal = performance.now();
      let res: Response | null = null;
      let data: any = null;
      const isLocalHost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (isLocalHost) {
        try {
          const testRes = await fetch("/api/local-fbr/health", { cache: "no-store", signal: AbortSignal.timeout(2000) });
          if (testRes.ok && testRes.headers.get("content-type")?.includes("json")) {
            data = await testRes.json();
            res = testRes;
          }
        } catch {}
      }

      if (!data) {
        try {
          const testRes = await fetch("http://127.0.0.1:5060/api/health", { cache: "no-store", signal: AbortSignal.timeout(2500) });
          if (testRes.ok && testRes.headers.get("content-type")?.includes("json")) {
            data = await testRes.json();
            res = testRes;
          }
        } catch {}
      }

      if (!data) {
        try {
          const testRes = await fetch("http://localhost:5060/api/health", { cache: "no-store", signal: AbortSignal.timeout(2500) });
          if (testRes.ok && testRes.headers.get("content-type")?.includes("json")) {
            data = await testRes.json();
            res = testRes;
          }
        } catch {}
      }

      const duration = Math.round(performance.now() - startLocal);

      if (data && (res?.ok || data.status)) {
        const fbrUpstream = data.upstream_fbr;
        setLocalHealth({
          status: fbrUpstream && fbrUpstream.status === 'unreachable' ? 'warning' : 'online',
          latency: duration,
          pos_id: data.pos_id || "189142",
          service: data.service || "fbr-local-proxy",
          timestamp: data.timestamp,
          upstream_fbr: fbrUpstream,
        });
      } else {
        setLocalHealth({
          status: "offline",
          latency: duration,
          message: "Local gateway is unreachable. Ensure fbr-gateway.exe is running on port 5060.",
        });
      }
    } catch (err: any) {
      setLocalHealth({
        status: "offline",
        message: "Local gateway is unreachable. Ensure fbr-gateway.exe is running on port 5060.",
      });
    } finally {
      setHealthTesting(false);
    }
  };

  // Fetch Fiscalization Statistics
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      // Total Sales Count
      const { count: totalSalesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });

      // Total Fiscalized Count
      const { count: totalFiscalizedCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .not("fbr_invoice_number", "is", null);

      // Pending (Unfiscalized) Sales Count
      const { count: pendingSalesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .is("fbr_invoice_number", null);

      // Today's Fiscalized Sales (count & total sum)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todaySalesData } = await supabase
        .from("sales")
        .select("total_amount")
        .not("fbr_invoice_number", "is", null)
        .gte("created_at", todayStart.toISOString());

      const todayCount = todaySalesData?.length || 0;
      const todayAmount = todaySalesData?.reduce((sum, s) => sum + Number(s.total_amount || 0), 0) || 0;

      setStats({
        todayCount,
        todayAmount,
        totalFiscalized: totalFiscalizedCount || 0,
        totalSales: totalSalesCount || 0,
        pendingCount: pendingSalesCount || 0,
      });
    } catch (err) {
      console.error("Failed to fetch FBR statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Recent Fiscalized Sales Feed
  const fetchRecentSales = async () => {
    setRecentLoading(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, customer_name, customer_phone, total_amount, payment_method, created_at, fbr_invoice_number, fbr_qr_code, status")
        .not("fbr_invoice_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setRecentSales((data as FiscalSale[]) || []);
    } catch (err) {
      console.error("Failed to fetch recent sales:", err);
    } finally {
      setRecentLoading(false);
    }
  };

  // Fetch Pending / Unfiscalized Sales
  const fetchPendingSales = async () => {
    setPendingLoading(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, customer_name, customer_phone, total_amount, payment_method, created_at, fbr_invoice_number, fbr_qr_code, status")
        .is("fbr_invoice_number", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPendingSales((data as FiscalSale[]) || []);
    } catch (err) {
      console.error("Failed to fetch pending sales:", err);
    } finally {
      setPendingLoading(false);
    }
  };

  // Refresh all page telemetry
  const refreshAll = () => {
    pingAllGateways();
    fetchStats();
    fetchRecentSales();
    fetchPendingSales();
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Save Settings Handler
  const onSaveSettings = (data: FbrSettingsForm) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast.success("FBR Settings saved successfully");
        pingAllGateways();
      },
      onError: (err: any) => {
        toast.error(`Failed to save settings: ${err.message}`);
      },
    });
  };

  // Gateway Selection Helper
  const handleSelectGateway = (targetUrl: string) => {
    setValue("fbr_api_url", targetUrl, { shouldDirty: true });
  };

  // Instant Gateway Switch Handler
  const handleInstantSwitchGateway = (targetUrl: string, gatewayLabel: string) => {
    setValue("fbr_api_url", targetUrl, { shouldDirty: true });
    updateSettings.mutate(
      {
        fbr_api_url: targetUrl,
        fbr_pos_id: watch("fbr_pos_id") || settings?.fbr_pos_id || "189142",
        fbr_integration_enabled: watch("fbr_integration_enabled") ?? settings?.fbr_integration_enabled ?? true,
      },
      {
        onSuccess: () => {
          toast.success(`Active gateway route switched to ${gatewayLabel}`);
          pingAllGateways();
        },
        onError: (err: any) => {
          toast.error(`Failed to switch gateway: ${err.message}`);
        },
      }
    );
  };

  // Fiscalize a single pending sale
  const handleFiscalizeSale = async (sale: FiscalSale) => {
    setProcessingSaleId(sale.id);
    const toastId = toast.loading(`Submitting sale ${sale.sale_number} to FBR...`);

    try {
      // 1. Fetch sale items
      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);

      if (itemsErr) throw itemsErr;

      // 2. Prepare items for FBR payload
      const cart = (items && items.length > 0)
        ? items.map((item) => ({
            product_id: item.product_id,
            name: item.product_name || "Item",
            quantity: item.quantity || 1,
            unit_price: Number(item.unit_price) || 0,
            total_price: Number(item.total_price) || 0,
            tax_percentage: item.tax_percentage || 0,
            tax_amount: item.tax_amount || 0,
            discount: item.discount || 0,
            pct_code: item.pct_code || "01011000",
          }))
        : [
            {
              product_id: "RETAIL",
              name: "Retail Sale",
              quantity: 1,
              unit_price: Number(sale.total_amount) || 0,
              total_price: Number(sale.total_amount) || 0,
              tax_percentage: 0,
              tax_amount: 0,
              discount: 0,
              pct_code: "01011000",
            },
          ];

      // 3. Build FBR payload
      const payload = await buildFBRInvoicePayload({
        cart,
        posId: parseInt(settings?.fbr_pos_id || "189142", 10),
        usin: sale.sale_number,
        paymentMethod: sale.payment_method === "cash" ? 1 : 2,
        invoiceDate: new Date(sale.created_at).toISOString(),
        discountAmount: 0,
        customerName: sale.customer_name || "Walk-in Customer",
      });

      // 4. Submit to FBR via Cloud Proxy
      const apiUrl = settings?.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice";
      const fbrResponse = await submitToFBR(apiUrl, payload);

      const rawInvoiceNo = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;
      let fbrInvoiceNumber = rawInvoiceNo;

      if (fbrInvoiceNumber && typeof fbrInvoiceNumber === "string" && fbrInvoiceNumber.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(fbrInvoiceNumber);
          fbrInvoiceNumber = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || fbrInvoiceNumber;
        } catch {
          // ignore
        }
      }

      if (!fbrInvoiceNumber || fbrInvoiceNumber === "Not Available") {
        throw new Error(fbrResponse.response || fbrResponse.Response || "FBR did not return a valid invoice number");
      }

      // 5. Generate QR Code
      const fbrQrCode = await QRCode.toDataURL(fbrInvoiceNumber);

      // 6. Update sale record in Supabase
      const { error: updateErr } = await supabase
        .from("sales")
        .update({
          fbr_invoice_number: fbrInvoiceNumber,
          fbr_qr_code: fbrQrCode,
        })
        .eq("id", sale.id);

      if (updateErr) throw updateErr;

      toast.success(`Fiscalized! FBR Invoice: ${fbrInvoiceNumber}`, { id: toastId });
      fetchPendingSales();
      fetchRecentSales();
      fetchStats();
    } catch (err: any) {
      console.error("Fiscalization failed:", err);
      toast.error(`Fiscalization failed: ${err.message}`, { id: toastId });
    } finally {
      setProcessingSaleId(null);
    }
  };

  // Batch Fiscalize All Pending Invoices
  const handleBatchFiscalize = async () => {
    if (pendingSales.length === 0) return;
    setBatchProcessing(true);
    let successCount = 0;
    let failCount = 0;

    toast.info(`Starting batch fiscalization of ${pendingSales.length} invoices...`);

    for (const sale of pendingSales) {
      try {
        const { data: items } = await supabase
          .from("sale_items")
          .select("*")
          .eq("sale_id", sale.id);

        const cart = (items && items.length > 0)
          ? items.map((item) => ({
              product_id: item.product_id,
              name: item.product_name || "Item",
              quantity: item.quantity || 1,
              unit_price: Number(item.unit_price) || 0,
              total_price: Number(item.total_price) || 0,
              tax_percentage: item.tax_percentage || 0,
              tax_amount: item.tax_amount || 0,
              discount: item.discount || 0,
              pct_code: item.pct_code || "01011000",
            }))
          : [
              {
                product_id: "RETAIL",
                name: "Retail Sale",
                quantity: 1,
                unit_price: Number(sale.total_amount) || 0,
                total_price: Number(sale.total_amount) || 0,
                tax_percentage: 0,
                tax_amount: 0,
                discount: 0,
                pct_code: "01011000",
              },
            ];

        const payload = await buildFBRInvoicePayload({
          cart,
          posId: parseInt(settings?.fbr_pos_id || "189142", 10),
          usin: sale.sale_number,
          paymentMethod: sale.payment_method === "cash" ? 1 : 2,
          invoiceDate: new Date(sale.created_at).toISOString(),
          discountAmount: 0,
          customerName: sale.customer_name || "Walk-in Customer",
        });

        const apiUrl = settings?.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice";
        const fbrResponse = await submitToFBR(apiUrl, payload);

        const rawInvoiceNo = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;
        let fbrInvoiceNumber = rawInvoiceNo;

        if (fbrInvoiceNumber && typeof fbrInvoiceNumber === "string" && fbrInvoiceNumber.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(fbrInvoiceNumber);
            fbrInvoiceNumber = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || fbrInvoiceNumber;
          } catch {
            // ignore
          }
        }

        if (fbrInvoiceNumber && fbrInvoiceNumber !== "Not Available") {
          const fbrQrCode = await QRCode.toDataURL(fbrInvoiceNumber);
          await supabase
            .from("sales")
            .update({ fbr_invoice_number: fbrInvoiceNumber, fbr_qr_code: fbrQrCode })
            .eq("id", sale.id);
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        console.error(`Batch item ${sale.sale_number} failed:`, e);
        failCount++;
      }
    }

    setBatchProcessing(false);
    toast.success(`Batch complete: ${successCount} fiscalized, ${failCount} failed.`);
    refreshAll();
  };

  // Copy FBR Invoice Number helper
  const handleCopyFbrNumber = (fbrNumber: string, id: string) => {
    navigator.clipboard.writeText(fbrNumber);
    setCopiedId(id);
    toast.success("FBR Invoice Number copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered recent sales
  const filteredRecentSales = useMemo(() => {
    if (!searchQuery.trim()) return recentSales;
    const q = searchQuery.toLowerCase().trim();
    return recentSales.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(q) ||
        (s.fbr_invoice_number && s.fbr_invoice_number.toLowerCase().includes(q)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q))
    );
  }, [recentSales, searchQuery]);

  // Overall compliance rate
  const complianceRate = useMemo(() => {
    if (stats.totalSales === 0) return "100%";
    return `${((stats.totalFiscalized / stats.totalSales) * 100).toFixed(2)}%`;
  }, [stats]);

  if (settingsLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Send className="w-5 h-5" />
              </div>
              FBR Integration & Fiscal Telemetry
            </h1>
          </div>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            Direct Tier-1 IMS Cloud Gateway (POS ID: <span className="font-mono font-medium text-foreground">{settings?.fbr_pos_id || "189142"}</span>)
          </p>
        </div>

        {/* Status indicator & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!(watch("fbr_integration_enabled") ?? settings?.fbr_integration_enabled ?? true) ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Fiscalization Disabled in Settings
            </div>
          ) : healthTesting || (isUsingLocalGateway ? localHealth : cloudHealth).status === "checking" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Probing {isUsingLocalGateway ? "Local Proxy" : "Cloud Gateway"}...
            </div>
          ) : (isUsingLocalGateway ? localHealth : cloudHealth).status === "online" &&
            (isUsingLocalGateway ? localHealth : cloudHealth).upstream_fbr?.status !== "unreachable" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {isUsingLocalGateway ? "Local Gateway Active (Pakistan IP)" : "Cloud Gateway Active (Singapore)"} •{" "}
              {(isUsingLocalGateway ? localHealth : cloudHealth).upstream_fbr?.latency_ms ??
                (isUsingLocalGateway ? localHealth : cloudHealth).latency ??
                0}
              ms
            </div>
          ) : (isUsingLocalGateway ? localHealth : cloudHealth).upstream_fbr?.status === "unreachable" ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm"
              title={(isUsingLocalGateway ? localHealth : cloudHealth).upstream_fbr?.error || "FBR server unreachable"}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {isUsingLocalGateway ? "Local Proxy Up, FBR Blocked" : "Cloud Up, FBR Unreachable"}
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 shadow-sm"
              title={(isUsingLocalGateway ? localHealth : cloudHealth).message || "Gateway offline"}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {isUsingLocalGateway ? "Local Gateway Offline" : "Cloud Gateway Offline"}
            </div>
          )}

          {/* FBR Environment Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/80 rounded-lg border border-border shadow-sm">
            <button
              type="button"
              onClick={() => setFbrEnvironment('sandbox')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                fbrEnvironment === 'sandbox'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🧪 Sandbox Mode
            </button>
            <button
              type="button"
              onClick={() => setFbrEnvironment('production')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                fbrEnvironment === 'production'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🟢 Live Production
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={pingAllGateways}
            disabled={healthTesting}
            className="h-9 px-3 gap-1.5 text-xs font-medium"
          >
            <Zap className={`w-3.5 h-3.5 text-primary ${healthTesting ? "animate-pulse" : ""}`} />
            Test Ping
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={statsLoading || recentLoading || pendingLoading}
            className="h-9 px-3 gap-1.5 text-xs font-medium"
          >
            <RotateCw className={`w-3.5 h-3.5 ${statsLoading || recentLoading || pendingLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* FBR Environment Mode Status Alert */}
      {fbrEnvironment === 'sandbox' ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-2">
              🧪 FBR Sandbox / Training Environment Active
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40">
                Safe Testing Mode
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Sales made in this mode generate simulated fiscal invoice numbers (<code>SANDBOX-189142-XXXX</code>) and test QR codes.
              Invoices will <strong>NOT</strong> be posted to your official FBR Iris Sales Tax Return (Annex-C).
              Printed receipts will display a test invoice banner. Switch to <strong>Live Production</strong> when ready to submit real fiscal transactions.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-2">
              🟢 Live Production Fiscalization Active
              <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40">
                Official FBR Iris
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              All checkout sales and credit bill completions are directly posted to the official FBR Tier-1 IMS servers and recorded on your official monthly Sales Tax Return.
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* KPI Stats Row (Matching akws / akhr StatCard Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Fiscalized Sales */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Today's Fiscalized
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                Rs. {stats.todayAmount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-primary" />
                {stats.todayCount} invoices submitted today
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Total Fiscalized Invoices */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Invoices
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {stats.totalFiscalized.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                {complianceRate} fiscal compliance
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Unfiscalized Queue */}
        <div className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-200 ${
          stats.pendingCount > 0 ? "border-amber-500/30 bg-amber-500/[0.02]" : "border-border bg-card"
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending Queue
              </p>
              <p className={`text-2xl font-bold tracking-tight ${
                stats.pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              }`}>
                {stats.pendingCount}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {stats.pendingCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Action needed: unverified bills</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">Zero backlog in queue</span>
                )}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              stats.pendingCount > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
            }`}>
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Active Gateway Route */}
        {(() => {
          const activeNode = isUsingLocalGateway ? localHealth : cloudHealth;
          const isOperational = activeNode.status === "online" && activeNode.upstream_fbr?.status !== "unreachable";
          const isFbrBlocked = activeNode.upstream_fbr?.status === "unreachable";

          return (
            <div
              className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-200 ${
                isOperational
                  ? "border-emerald-500/20 bg-card"
                  : isFbrBlocked
                  ? "border-amber-500/30 bg-amber-500/[0.02]"
                  : "border-destructive/30 bg-destructive/[0.02]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Active Gateway
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                        isUsingLocalGateway
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                      }`}
                    >
                      {isUsingLocalGateway ? "Local Pakistan IP" : "Cloud Droplet"}
                    </Badge>
                  </div>
                  <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                    {healthTesting || activeNode.status === "checking" ? (
                      <span className="text-muted-foreground text-lg flex items-center gap-1.5 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Probing...
                      </span>
                    ) : isOperational ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xl font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Operational
                      </span>
                    ) : isFbrBlocked ? (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xl font-bold">
                        <AlertTriangle className="w-5 h-5 text-amber-500" /> FBR Blocked
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1.5 text-xl font-bold">
                        <AlertTriangle className="w-5 h-5 text-destructive" /> Offline
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                    {isOperational ? (
                      <span>
                        FBR: {activeNode.upstream_fbr?.latency_ms ?? activeNode.latency ?? 0}ms •{" "}
                        {isUsingLocalGateway ? "Domestic Shop IP" : "gw.fbr.gov.pk"}
                      </span>
                    ) : isFbrBlocked ? (
                      <span className="text-amber-600 dark:text-amber-400">Upstream socket timed out</span>
                    ) : isUsingLocalGateway ? (
                      <span className="text-destructive">Double-click desktop launcher to start</span>
                    ) : (
                      <span className="text-destructive">Cloud proxy connection failed</span>
                    )}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    isOperational
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : isFbrBlocked
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {isUsingLocalGateway ? <Laptop className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="recent" className="w-full space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="recent" className="rounded-lg text-xs font-medium data-[state=active]:shadow-sm">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Recent Invoices
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg text-xs font-medium data-[state=active]:shadow-sm relative">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Pending Queue
            {stats.pendingCount > 0 && (
              <Badge className="ml-1.5 bg-amber-500 text-white dark:bg-amber-600 text-[10px] px-1.5 py-0 h-4 border-none">
                {stats.pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-xs font-medium data-[state=active]:shadow-sm">
            <Sliders className="w-3.5 h-3.5 mr-1.5" />
            Gateway Config
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Recent Invoices Feed */}
        <TabsContent value="recent" className="space-y-4 outline-none">
          <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
            <CardHeader className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/10 border-b border-border">
              <div>
                <CardTitle className="text-base font-semibold">Recent FBR Submissions Feed</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Live audit trail of retail bills successfully transmitted to FBR Tier-1 central servers
                </CardDescription>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by bill #, FBR #, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-lg"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Sale Bill #
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        FBR Fiscal Number
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Date & Time
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Customer
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3 text-right">
                        Amount (PKR)
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3 text-center">
                        Method
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3 text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                          Loading recent fiscal transactions...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecentSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                          <Receipt className="w-8 h-8 opacity-25 mx-auto mb-2" />
                          No matching fiscalized invoices found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecentSales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-foreground py-3">
                            {sale.sale_number}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md select-all">
                                {sale.fbr_invoice_number}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyFbrNumber(sale.fbr_invoice_number!, sale.id)}
                                className="h-6 w-6 rounded-md hover:bg-muted"
                                title="Copy FBR Invoice Number"
                              >
                                {copiedId === sale.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                            {format(new Date(sale.created_at), "MMM d, yyyy • h:mm a")}
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-3">
                            {sale.customer_name || "Walk-in Customer"}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-right text-foreground py-3">
                            Rs. {Number(sale.total_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge variant="outline" className="capitalize text-[10px] font-normal px-2 py-0">
                              {sale.payment_method || "cash"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQrModalSale(sale)}
                              className="h-7 px-2.5 text-[11px] gap-1 rounded-lg"
                            >
                              <QrCode className="w-3.5 h-3.5 text-primary" />
                              View QR
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Pending / Unfiscalized Queue */}
        <TabsContent value="pending" className="space-y-4 outline-none">
          <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
            <CardHeader className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/10 border-b border-border">
              <div>
                <CardTitle className="text-base font-semibold">Unfiscalized Invoices Queue</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Bills generated at checkout that failed or missed FBR fiscalization due to network or timeout issues
                </CardDescription>
              </div>

              {pendingSales.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBatchFiscalize}
                  disabled={batchProcessing || processingSaleId !== null}
                  className="h-8 px-3 text-xs gap-1.5 rounded-lg shadow-sm"
                >
                  {batchProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Fiscalize All ({pendingSales.length})
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Sale Bill #
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Date & Time
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Customer
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3 text-right">
                        Amount (PKR)
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3">
                        Issue / Status
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider py-3 text-center">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                          Checking unfiscalized queue...
                        </TableCell>
                      </TableRow>
                    ) : pendingSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <div className="max-w-md mx-auto space-y-2 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">All Invoices Fully Fiscalized</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              There are currently zero pending bills. Every retail transaction generated in the POS has received an official FBR Fiscal Number.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingSales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-foreground py-3">
                            {sale.sale_number}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                            {format(new Date(sale.created_at), "MMM d, yyyy • h:mm a")}
                          </TableCell>
                          <TableCell className="text-xs text-foreground py-3">
                            {sale.customer_name || "Walk-in Customer"}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-right text-foreground py-3">
                            Rs. {Number(sale.total_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              Missing FBR Fiscal Number
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFiscalizeSale(sale)}
                              disabled={processingSaleId === sale.id || batchProcessing}
                              className="h-7 px-3 text-xs gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                            >
                              {processingSaleId === sale.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              Fiscalize Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Gateway Configuration & Diagnostics */}
        <TabsContent value="settings" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Settings Form Card */}
            <Card className="lg:col-span-2 rounded-xl border border-border shadow-sm">
              <form onSubmit={handleSubmit(onSaveSettings)}>
                <CardHeader className="p-5 border-b border-border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    <div>
                      <CardTitle className="text-base font-semibold">Dual Gateway & Routing Configuration</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Switch between Singapore Cloud Droplet and Local Pakistan Counter Gateway
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20">
                    <div className="space-y-0.5">
                      <Label htmlFor="fbr_integration_enabled" className="text-sm font-medium cursor-pointer">
                        Enable FBR Real-time Fiscalization
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically submit completed sales to FBR Tier-1 IMS during checkout
                      </p>
                    </div>
                    <Controller
                      name="fbr_integration_enabled"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="fbr_integration_enabled"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  {/* Manual Gateway Selector Cards */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold text-foreground">Select Active Gateway Route</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Choose the network route for FBR invoice submissions. If international traffic is restricted or blocked, switch to the Local Shop Gateway.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Option 1: Cloud Droplet Gateway */}
                      <div
                        onClick={() => handleSelectGateway(CLOUD_GATEWAY_URL)}
                        className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          !isUsingLocalGateway
                            ? "border-primary bg-primary/[0.03] ring-2 ring-primary/20 shadow-sm"
                            : "border-border hover:border-border/80 bg-card hover:bg-muted/10"
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <Cloud className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-foreground">Cloud Droplet Gateway</h4>
                                <p className="text-[10px] text-muted-foreground">DigitalOcean • Singapore</p>
                              </div>
                            </div>
                            {!isUsingLocalGateway && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 border-none">
                                Active
                              </Badge>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Standard primary route. Hosted in Singapore datacenter. Bypasses local counter hardware.
                          </p>

                          {/* Live health status */}
                          <div className="pt-1">
                            {cloudHealth.status === "online" && cloudHealth.upstream_fbr?.status !== "unreachable" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Droplet Online (FBR: {cloudHealth.upstream_fbr?.latency_ms ?? cloudHealth.latency}ms)
                              </span>
                            ) : cloudHealth.upstream_fbr?.status === "unreachable" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Droplet Up, FBR Blocked/Throttled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Droplet Offline
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                            :5060 (Droplet)
                          </span>
                          {!isUsingLocalGateway ? (
                            <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Connected
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstantSwitchGateway(CLOUD_GATEWAY_URL, "Cloud Droplet Gateway");
                              }}
                              className="h-6 text-[10px] px-2.5 rounded-md"
                            >
                              Switch to Cloud
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Option 2: Local Shop Gateway */}
                      <div
                        onClick={() => handleSelectGateway(LOCAL_GATEWAY_URL)}
                        className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          isUsingLocalGateway
                            ? "border-primary bg-primary/[0.03] ring-2 ring-primary/20 shadow-sm"
                            : "border-border hover:border-border/80 bg-card hover:bg-muted/10"
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <Laptop className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-foreground">Local Shop Gateway</h4>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Domestic Pakistan IP</p>
                              </div>
                            </div>
                            {isUsingLocalGateway && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 border-none">
                                Active
                              </Badge>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Runs on this counter computer. Direct Pakistan domestic internet bypasses international routing blocks.
                          </p>

                          {/* Live health status */}
                          <div className="pt-1">
                            {localHealth.status === "online" && localHealth.upstream_fbr?.status !== "unreachable" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Local Proxy Running (FBR: {localHealth.upstream_fbr?.latency_ms ?? localHealth.latency}ms)
                              </span>
                            ) : localHealth.status === "offline" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                Proxy Stopped (Launch from Desktop)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Proxy Error: {localHealth.message}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                            localhost:5060
                          </span>
                          {isUsingLocalGateway ? (
                            <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Connected
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstantSwitchGateway(LOCAL_GATEWAY_URL, "Local Shop Gateway");
                              }}
                              className="h-6 text-[10px] px-2.5 rounded-md"
                            >
                              Switch to Local
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Launcher Helper Card */}
                    <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-[11px] text-muted-foreground flex items-start gap-2.5">
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">
                          Desktop 1-Click Proxy Control:
                        </p>
                        <p>
                          To start the local gateway, double-click <strong>Start FBR Local Gateway</strong> on your desktop. To stop it, double-click <strong>Stop FBR Local Gateway</strong>. No terminal commands required!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="fbr_pos_id" className="text-sm font-medium">FBR POS ID</Label>
                      <Input
                        id="fbr_pos_id"
                        {...register("fbr_pos_id")}
                        placeholder="189142"
                        className="h-10 font-mono rounded-lg"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Your registered FBR Point of Sale identifier.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fbr_api_url" className="text-sm font-medium">Gateway Endpoint URL</Label>
                      <Input
                        id="fbr_api_url"
                        {...register("fbr_api_url")}
                        placeholder={CLOUD_GATEWAY_URL}
                        className="h-10 font-mono text-xs rounded-lg"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Auto-filled based on the route selected above.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={!isDirty || updateSettings.isPending}
                      className="h-9 px-4 text-xs rounded-lg gap-1.5"
                    >
                      {updateSettings.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>

            {/* Diagnostics Card */}
            <Card className="rounded-xl border border-border shadow-sm flex flex-col justify-between">
              <CardHeader className="p-5 border-b border-border bg-muted/10">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <div>
                    <CardTitle className="text-base font-semibold">Dual Gateway Telemetry</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Live tunnel & upstream diagnostic stats</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {/* Cloud Node Telemetry */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-primary" />
                      Cloud Droplet (Singapore)
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${
                        cloudHealth.status === "online" && cloudHealth.upstream_fbr?.status !== "unreachable"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : cloudHealth.upstream_fbr?.status === "unreachable"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {cloudHealth.status === "online" && cloudHealth.upstream_fbr?.status !== "unreachable"
                        ? "Operational"
                        : cloudHealth.upstream_fbr?.status === "unreachable"
                        ? "FBR Blocked"
                        : "Offline"}
                    </Badge>
                  </div>

                  <div className="space-y-1 pl-5 text-[11px] text-muted-foreground font-mono">
                    <div className="flex justify-between">
                      <span>Node Ping:</span>
                      <span className="text-foreground">{cloudHealth.latency !== undefined ? `${cloudHealth.latency} ms` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FBR Upstream:</span>
                      <span className={cloudHealth.upstream_fbr?.status === "online" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400"}>
                        {cloudHealth.upstream_fbr?.status === "online"
                          ? `${cloudHealth.upstream_fbr.latency_ms} ms`
                          : cloudHealth.upstream_fbr?.error
                          ? "Timeout/Blocked"
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Local Proxy Telemetry */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Local Proxy (Pakistan IP)
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${
                        localHealth.status === "online"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {localHealth.status === "online" ? "Operational" : "Stopped"}
                    </Badge>
                  </div>

                  <div className="space-y-1 pl-5 text-[11px] text-muted-foreground font-mono">
                    <div className="flex justify-between">
                      <span>Proxy Latency:</span>
                      <span className="text-foreground">{localHealth.latency !== undefined ? `${localHealth.latency} ms` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FBR Upstream:</span>
                      <span className={localHealth.upstream_fbr?.status === "online" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"}>
                        {localHealth.upstream_fbr?.status === "online"
                          ? `${localHealth.upstream_fbr.latency_ms} ms`
                          : "Proxy stopped"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={pingAllGateways}
                    disabled={healthTesting}
                    className="w-full h-8 text-xs gap-1.5 rounded-lg"
                  >
                    <Zap className={`w-3.5 h-3.5 text-primary ${healthTesting ? "animate-pulse" : ""}`} />
                    Probe All Gateways
                  </Button>
                </div>
              </CardContent>

              <div className="p-4 bg-muted/20 border-t border-border/50 rounded-b-xl">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Both gateways communicate directly with official FBR IMS servers via OAuth Bearer token authentication. Bills fiscalized through either gateway are immediately verifiable on the <strong>FBR Tax Asaan</strong> app.
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Preview Modal */}
      <Dialog open={!!qrModalSale} onOpenChange={(open) => !open && setQrModalSale(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-6 text-center">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              FBR Fiscal QR Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              Official Tax Verification for Bill <strong>{qrModalSale?.sale_number}</strong>
            </DialogDescription>
          </DialogHeader>

          {qrModalSale && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-white border border-border shadow-inner mx-auto w-fit">
                {qrModalSale.fbr_qr_code ? (
                  <img
                    src={qrModalSale.fbr_qr_code}
                    alt="FBR QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-muted-foreground text-xs font-mono">
                    No QR Generated
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  FBR Fiscal Invoice Number
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-mono text-xs font-bold bg-muted px-2.5 py-1 rounded-md text-foreground select-all border border-border">
                    {qrModalSale.fbr_invoice_number}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyFbrNumber(qrModalSale.fbr_invoice_number!, qrModalSale.id)}
                    className="h-7 w-7 rounded-md"
                    title="Copy"
                  >
                    {copiedId === qrModalSale.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground text-left space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Government Verified
                </p>
                <p>
                  Scan this code using the <strong>FBR Tax Asaan</strong> app or any QR reader to inspect the registered tax details.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FbrDashboard;
