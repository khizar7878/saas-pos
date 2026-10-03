import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Landmark,
  Truck,
  Phone,
  Megaphone,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function OnlineStoreSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Form State
  const [storeName, setStoreName] = useState("Abr e Karam Fabrics");
  const [storeTagline, setStoreTagline] = useState("Quality Fabrics for Everyone");
  const [supportPhone, setSupportPhone] = useState("03228515152");
  const [supportWhatsapp, setSupportWhatsapp] = useState("03228515152");
  const [supportEmail, setSupportEmail] = useState("contact@abrekaram.com");
  const [outletAddress, setOutletAddress] = useState("Cloth Market, Faisalabad");
  const [outletCity, setOutletCity] = useState("Faisalabad");

  // Shipping Rates
  const [deliveryCharge, setDeliveryCharge] = useState(250);
  const [freeShippingMinAmount, setFreeShippingMinAmount] = useState(5000);
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState("2 - 4 Working Days");

  // Direct Bank IBFT Details
  const [bankName, setBankName] = useState("Meezan Bank Limited");
  const [accountTitle, setAccountTitle] = useState("Abr e Karam Fabrics");
  const [accountNumber, setAccountNumber] = useState("01010102938475");
  const [ibanNumber, setIbanNumber] = useState("PK36MEZN0001010102938475");
  const [paymentInstructions, setPaymentInstructions] = useState(
    "Please transfer the total order amount via IBFT/EasyPaisa/JazzCash and attach the payment proof screenshot or reference ID during checkout."
  );

  // Outlet & Location
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  // Announcement Banner & Social
  const [announcementText, setAnnouncementText] = useState(
    "✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!"
  );
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(true);
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading store_settings:", error);
      }

      if (data) {
        setSettingsId(data.id);
        setStoreName(data.store_name || "Abr e Karam Fabrics");
        setStoreTagline(data.store_tagline || "Quality Fabrics for Everyone");
        setSupportPhone(data.support_phone || "03228515152");
        setSupportWhatsapp(data.support_whatsapp || "03228515152");
        setSupportEmail(data.support_email || "contact@abrekaram.com");
        setOutletAddress(data.outlet_address || "Cloth Market, Faisalabad");
        setOutletCity(data.outlet_city || "Faisalabad");
        setGoogleMapsUrl(data.google_maps_url || data.map_location_url || "");

        setDeliveryCharge(Number(data.delivery_charge) || 250);
        setFreeShippingMinAmount(Number(data.free_shipping_min_amount) || 5000);
        setEstimatedDeliveryDays(data.estimated_delivery_days || "2 - 4 Working Days");

        setBankName(data.bank_name || "Meezan Bank Limited");
        setAccountTitle(data.account_title || "Abr e Karam Fabrics");
        setAccountNumber(data.account_number || "01010102938475");
        setIbanNumber(data.iban_number || "PK36MEZN0001010102938475");
        setPaymentInstructions(
          data.payment_instructions ||
            "Please transfer the total order amount via IBFT/EasyPaisa/JazzCash and attach the payment proof screenshot or reference ID during checkout."
        );

        setAnnouncementText(
          data.announcement_text ||
            "✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!"
        );
        setIsAnnouncementActive(data.is_announcement_active !== false);
        setFacebookUrl(data.facebook_url || "");
        setInstagramUrl(data.instagram_url || "");
      }
    } catch (err: any) {
      console.error("Fetch settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const payload = {
        store_name: storeName.trim(),
        store_tagline: storeTagline.trim(),
        support_phone: supportPhone.trim(),
        support_whatsapp: supportWhatsapp.trim(),
        support_email: supportEmail.trim(),
        outlet_address: outletAddress.trim(),
        outlet_city: outletCity.trim(),
        google_maps_url: googleMapsUrl.trim(),
        delivery_charge: Number(deliveryCharge) || 0,
        free_shipping_min_amount: Number(freeShippingMinAmount) || 0,
        estimated_delivery_days: estimatedDeliveryDays.trim(),
        bank_name: bankName.trim(),
        account_title: accountTitle.trim(),
        account_number: accountNumber.trim(),
        iban_number: ibanNumber.trim(),
        payment_instructions: paymentInstructions.trim(),
        announcement_text: announcementText.trim(),
        is_announcement_active: isAnnouncementActive,
        facebook_url: facebookUrl.trim(),
        instagram_url: instagramUrl.trim(),
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from("store_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("store_settings")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      toast.success("Online Store Settings saved! Live updates sent to ak-online.");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm py-12">
        Loading Online Store Settings configuration...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Online Store Settings</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure direct IBFT bank verification details, delivery rates, contact info, and storefront announcement banner.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-primary text-primary-foreground font-bold text-xs gap-2 h-11 px-6 rounded-xl shadow-md shrink-0"
        >
          {saving ? (
            "Saving Changes..."
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Save & Publish Settings
            </>
          )}
        </Button>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: Direct IBFT Bank Details */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Landmark className="w-5 h-5 text-amber-500" />
              Direct IBFT Bank Account Details
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              These details are displayed to customers during checkout for direct bank payment.
            </p>
          </CardHeader>

          <CardContent className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Bank Name *
              </label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Meezan Bank Limited, HBL, Faysal Bank"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Account Title / Beneficiary *
              </label>
              <Input
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                placeholder="e.g. Abr e Karam Fabrics"
                className="h-10 text-xs font-semibold rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Account Number *
                </label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="01010102938475"
                  className="h-10 text-xs font-mono rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  IBAN Number *
                </label>
                <Input
                  value={ibanNumber}
                  onChange={(e) => setIbanNumber(e.target.value)}
                  placeholder="PK36MEZN0001010102938475"
                  className="h-10 text-xs font-mono rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Payment Proof Instructions & Guidance
              </label>
              <textarea
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="Guide customers on how to upload payment proof screenshot..."
                className="w-full p-3 text-xs rounded-xl border border-input bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: Delivery Charges & Shipping Policy */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Truck className="w-5 h-5 text-emerald-600" />
              Delivery Charges & Shipping Rates
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure flat shipping rates, free delivery thresholds, and delivery lead times.
            </p>
          </CardHeader>

          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Flat Delivery Charge (PKR) *
                </label>
                <Input
                  type="number"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                  placeholder="250"
                  className="h-10 text-xs font-bold text-emerald-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Free Shipping Threshold (PKR)
                </label>
                <Input
                  type="number"
                  value={freeShippingMinAmount}
                  onChange={(e) => setFreeShippingMinAmount(Number(e.target.value))}
                  placeholder="5000 (Set to 0 to disable)"
                  className="h-10 text-xs font-bold text-primary rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Estimated Delivery Lead Time
              </label>
              <Input
                value={estimatedDeliveryDays}
                onChange={(e) => setEstimatedDeliveryDays(e.target.value)}
                placeholder="2 - 4 Working Days"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
              <span className="font-bold text-xs block text-foreground">💡 Live Shipping Rule Preview:</span>
              <p className="text-[11px] text-muted-foreground">
                Orders under <strong>Rs. {freeShippingMinAmount.toLocaleString()}</strong> will incur a delivery fee of <strong>Rs. {deliveryCharge}</strong>. Orders <strong>Rs. {freeShippingMinAmount.toLocaleString()} or above</strong> get <strong>FREE SHIPPING</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: Store Contact & Business Info */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Phone className="w-5 h-5 text-sky-600" />
              Store Contact & Outlet Information
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Contact numbers displayed on customer invoices, store navbar, and support footers.
            </p>
          </CardHeader>

          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Support Phone Number *
                </label>
                <Input
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="03228515152"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  WhatsApp Support Number *
                </label>
                <Input
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="03228515152"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Support Email Address *
              </label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="contact@abrekaram.com"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Outlet Address
                </label>
                <Input
                  value={outletAddress}
                  onChange={(e) => setOutletAddress(e.target.value)}
                  placeholder="Cloth Market, Main Bazaar"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Outlet City
                </label>
                <Input
                  value={outletCity}
                  onChange={(e) => setOutletCity(e.target.value)}
                  placeholder="Faisalabad"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Store Location (Google Maps Link / Embed URL)
              </label>
              <Input
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/embed?pb=..."
                className="h-10 text-xs rounded-xl font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter your store location link or Google Maps embed URL to display the interactive map window on the website footer.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: Announcement Bar & Social Links */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Megaphone className="w-5 h-5 text-purple-600" />
              Storefront Announcement Bar & Social Links
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Customize top marquee announcement banner and official social profiles.
            </p>
          </CardHeader>

          <CardContent className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
              <div>
                <strong className="block font-bold text-xs text-foreground">Top Announcement Bar Active</strong>
                <span className="text-[10px] text-muted-foreground">Displays promotional banner at top of store website</span>
              </div>
              <Switch
                checked={isAnnouncementActive}
                onCheckedChange={setIsAnnouncementActive}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Announcement Text Banner
              </label>
              <Input
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!"
                className="h-10 text-xs rounded-xl font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Instagram Profile Link
                </label>
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/abrekaram"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Facebook Page Link
                </label>
                <Input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/abrekaram"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Save Bottom Floating Action Bar */}
      <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>All changes will be reflected live on <strong>ak-online</strong> instantly.</span>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-primary text-primary-foreground font-bold text-xs gap-2 h-11 px-8 rounded-xl shadow-md"
        >
          {saving ? (
            "Saving Changes..."
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Save & Publish Settings
            </>
          )}
        </Button>
      </div>

    </div>
  );
}
