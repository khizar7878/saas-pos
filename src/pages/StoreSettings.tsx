import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Store, Save, Mail, Phone, MapPin, FileText, Image, Sliders, Palette, CalendarDays } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme/ThemeProvider";

interface StoreSettingsForm {
    store_name: string;
    address: string;
    phone: string;
    alt_phone: string;
    email: string;
    header_text: string;
    footer_text: string;
    exchange_policy: string;
    logo_url?: string;
    weekly_off_days?: string[];
}

const StoreSettings = () => {
    const { data: settings, isLoading } = useStoreSettings();
    const updateSettings = useUpdateStoreSettings();

    const { theme, setTheme } = useTheme();

    const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm<StoreSettingsForm>();

    useEffect(() => {
        if (settings) {
            reset({
                store_name: settings.store_name || "",
                address: settings.address || "",
                phone: settings.phone || "",
                alt_phone: settings.alt_phone || "",
                email: settings.email || "",
                header_text: settings.header_text || "",
                footer_text: settings.footer_text || "",
                exchange_policy: settings.exchange_policy || "",
                logo_url: settings.logo_url || "",
                weekly_off_days: Array.isArray(settings.weekly_off_days) ? settings.weekly_off_days : ['friday'],
            });
        }
    }, [settings, reset]);

    const onSubmit = (data: StoreSettingsForm) => {
        updateSettings.mutate(data);
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <Store className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
                        <p className="text-sm text-muted-foreground">Manage your store details, branding, and integrations</p>
                    </div>
                </div>
                
                <Button 
                    type="submit" 
                    form="store-settings-form"
                    disabled={!isDirty || updateSettings.isPending} 
                    className="gap-2 shadow-sm font-semibold hidden sm:flex"
                >
                    {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </Button>
            </div>

            <div className="flex-1 overflow-auto pr-1">
                <form id="store-settings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-8">
                    <div className="grid gap-6 lg:grid-cols-2 items-start">
                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Card 1: General Information */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <Store className="w-4 h-4 text-primary" />
                                    <span>General Information</span>
                                </div>
                                <Separator />

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="store_name" className="text-sm font-medium">Store Name *</Label>
                                        <Input id="store_name" {...register("store_name", { required: true })} placeholder="e.g. Abr e Karam Fabrics" className="h-10" />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                                        </div>
                                        <Input id="email" {...register("email")} placeholder="contact@example.com" className="h-10" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Contact & Location */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <span>Contact & Location</span>
                                </div>
                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-sm font-medium">Address *</Label>
                                    <Textarea id="address" {...register("address", { required: true })} placeholder="Shop Address..." className="min-h-[80px] resize-none" />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label htmlFor="phone" className="text-sm font-medium">Primary Phone *</Label>
                                        </div>
                                        <Input id="phone" {...register("phone", { required: true })} placeholder="0300-1234567" className="h-10" />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label htmlFor="alt_phone" className="text-sm font-medium">Secondary Phone</Label>
                                        </div>
                                        <Input id="alt_phone" {...register("alt_phone")} placeholder="042-1234567" className="h-10" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Brand Logo */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <Image className="w-4 h-4 text-primary" />
                                    <span>Brand Logo</span>
                                </div>
                                <Separator />

                                <div className="flex flex-col sm:flex-row gap-5 items-start">
                                    <div className="border-2 border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center w-28 h-28 shrink-0 bg-muted/30">
                                        {settings?.logo_url ? (
                                            <div className="relative group w-full h-full flex items-center justify-center">
                                                <img
                                                    src={settings.logo_url}
                                                    alt="Store Logo"
                                                    className="w-full h-full object-contain rounded-lg"
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground p-1 flex flex-col items-center">
                                                <Store className="w-6 h-6 mb-1 opacity-40" />
                                                <span className="text-[10px] font-medium">No Logo</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 flex-1 w-full">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="logo" className="text-sm font-medium">Upload Logo Image</Label>
                                            <Input
                                                id="logo"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 2 * 1024 * 1024) { // 2MB limit
                                                            alert("File size must be less than 2MB");
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            const base64String = reader.result as string;
                                                            updateSettings.mutate({
                                                                ...settings, // Keep existing
                                                                logo_url: base64String
                                                            });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="cursor-pointer file:cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Recommended: Square image (e.g. 300x300px), max size 2MB.
                                            Logo will appear on Login screen & Thermal Invoices.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Card 4: Receipt & Bill Customization */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <span>Receipt & Bill Customization</span>
                                </div>
                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="header_text" className="text-sm font-medium">Header Text</Label>
                                    <Input id="header_text" {...register("header_text")} placeholder="e.g. Premium Quality Fabrics" className="h-10" />
                                    <p className="text-[11px] text-muted-foreground">Appears directly below the store name on printed bills.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="footer_text" className="text-sm font-medium">Footer Text</Label>
                                    <Input id="footer_text" {...register("footer_text")} placeholder="e.g. No Return / Exchange after cutting" className="h-10" />
                                    <p className="text-[11px] text-muted-foreground">Appears at the very bottom of printed bills.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="exchange_policy" className="text-sm font-medium">Exchange Policy</Label>
                                    <Textarea
                                        id="exchange_policy"
                                        {...register("exchange_policy")}
                                        placeholder="Enter detailed exchange policy to appear on the invoice..."
                                        className="min-h-[90px] resize-none"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Appears as a dedicated section at the bottom of standard invoices.</p>
                                </div>
                            </div>

                            {/* Card 5: Operating Schedule & Routine Off Days */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <CalendarDays className="w-4 h-4 text-primary" />
                                    <span>Operating Schedule & Weekly Off Days</span>
                                </div>
                                <Separator />

                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">Routine Weekly Off Days</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Select days when your retail outlet is normally closed. Daily Reconciliation will skip these days when carrying over opening balances (e.g. carry Thursday's closing directly into Saturday if Friday is off).
                                        </p>
                                    </div>

                                    {(() => {
                                        const selectedOffDays: string[] = watch("weekly_off_days") || [];
                                        const weekdays = [
                                            { id: 'monday', label: 'Monday', short: 'Mon' },
                                            { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
                                            { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
                                            { id: 'thursday', label: 'Thursday', short: 'Thu' },
                                            { id: 'friday', label: 'Friday', short: 'Fri' },
                                            { id: 'saturday', label: 'Saturday', short: 'Sat' },
                                            { id: 'sunday', label: 'Sunday', short: 'Sun' },
                                        ];

                                        const toggleDay = (dayId: string) => {
                                            const current = [...selectedOffDays];
                                            const idx = current.indexOf(dayId);
                                            let next: string[];
                                            if (idx >= 0) {
                                                next = current.filter(d => d !== dayId);
                                            } else {
                                                next = [...current, dayId];
                                            }
                                            setValue("weekly_off_days", next, { shouldDirty: true });
                                        };

                                        return (
                                            <div className="space-y-2 pt-1">
                                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                                                    {weekdays.map((w) => {
                                                        const isOff = selectedOffDays.includes(w.id);
                                                        return (
                                                            <button
                                                                key={w.id}
                                                                type="button"
                                                                onClick={() => toggleDay(w.id)}
                                                                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold transition-all select-none active:scale-95 ${
                                                                    isOff
                                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/30"
                                                                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                                                                }`}
                                                            >
                                                                <span>{w.short}</span>
                                                                <span className="text-[9px] opacity-80 mt-0.5">
                                                                    {isOff ? "OFF" : "OPEN"}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between">
                                                    <span>
                                                        Active off day(s): {selectedOffDays.length > 0 ? selectedOffDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') : 'None (Store open 7 days)'}
                                                    </span>
                                                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                                        Non-destructive: Past reconciliations preserve their original records
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Card 6: Appearance */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                    <Palette className="w-4 h-4 text-primary" />
                                    <span>Appearance</span>
                                </div>
                                <Separator />

                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">Application Theme</Label>
                                        <p className="text-xs text-muted-foreground">Select your preferred color scheme & tone</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        {([
                                            { id: "light" as const, label: "Ocean", badge: "Default", swatches: ["#ffffff", "#295975", "#3a7ea8", "#e8f4f8"], ring: "#295975" },
                                            { id: "dark" as const, label: "Dark", badge: null, swatches: ["#171717", "#b3b3b3", "#d4d4d4", "#262626"], ring: "#b3b3b3" },
                                            { id: "purple" as const, label: "Violet", badge: null, swatches: ["#ffffff", "#5e4074", "#8a66a8", "#f0ebf5"], ring: "#5e4074" },
                                        ] as const).map((t) => {
                                            const isActive = theme === t.id;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setTheme(t.id)}
                                                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 transition-all text-center select-none active:scale-[0.98] ${
                                                        isActive
                                                            ? "border-primary bg-primary/5 shadow-sm"
                                                            : "border-border hover:border-primary/30 hover:bg-muted/20"
                                                    }`}
                                                >
                                                    {/* Swatch strip */}
                                                    <span
                                                        className="flex h-6 w-full rounded-md overflow-hidden border border-border/50"
                                                        style={{ boxShadow: isActive ? `0 0 0 1.5px ${t.ring}` : undefined }}
                                                    >
                                                        {t.swatches.map((color, i) => (
                                                            <span key={i} className="flex-1 h-full" style={{ background: color }} />
                                                        ))}
                                                    </span>
                                                    <span className="flex flex-col items-center gap-0.5">
                                                        <span className={`text-xs font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
                                                        {t.badge && (
                                                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full font-bold">{t.badge}</span>
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Save Changes Bar for Mobile and extra desktop convenience */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-border mt-8">
                        <Button 
                            type="submit" 
                            disabled={!isDirty || updateSettings.isPending} 
                            className="gap-2 w-full sm:w-auto shadow-sm font-semibold h-11 sm:h-10"
                        >
                            {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StoreSettings;
