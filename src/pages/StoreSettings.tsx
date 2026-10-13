import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Store, Save, Mail, Phone, MapPin, FileText, Image, Sliders, Palette, CalendarDays, Tags, Plus, Trash2, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { INDUSTRY_ARCHETYPES, getArchetypeById, type CustomProductField } from "@/config/industryArchetypes";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

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
    lexicon?: {
        item_singular: string;
        item_plural: string;
        primary_unit: string;
        secondary_metric_name?: string | null;
        secondary_metric_symbol?: string | null;
        enable_secondary_metric: boolean;
        allow_fractional_qty: boolean;
    };
    custom_product_fields?: CustomProductField[];
}

const StoreSettings = () => {
    const { data: settings, isLoading } = useStoreSettings();
    const updateSettings = useUpdateStoreSettings();
    const { currentStore } = useTenant();

    const { theme, setTheme } = useTheme();

    const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm<StoreSettingsForm>();

    // Local state for adding a new attribute field
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldType, setNewFieldType] = useState<"text" | "number" | "select" | "date">("text");
    const [newFieldOptions, setNewFieldOptions] = useState("");
    const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");

    useEffect(() => {
        if (settings) {
            const archetype = getArchetypeById(currentStore?.business_type);
            const initialFields = Array.isArray(settings.custom_product_fields) && settings.custom_product_fields.length > 0
                ? settings.custom_product_fields
                : (archetype.defaultCustomFields || []);

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
                lexicon: settings.lexicon || {
                    item_singular: "Product",
                    item_plural: "Products",
                    primary_unit: "pcs",
                    secondary_metric_name: "Meters",
                    secondary_metric_symbol: "m",
                    enable_secondary_metric: false,
                    allow_fractional_qty: false
                },
                custom_product_fields: initialFields,
            });
        }
    }, [settings, currentStore?.business_type, reset]);

    const handleAddCustomField = () => {
        if (!newFieldName.trim()) {
            toast.error("Please enter an attribute name");
            return;
        }
        const slug = newFieldName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const currentList: CustomProductField[] = watch("custom_product_fields") || [];
        if (currentList.some(f => f.id === slug)) {
            toast.error(`An attribute with ID '${slug}' already exists`);
            return;
        }
        const newField: CustomProductField = {
            id: slug,
            name: newFieldName.trim(),
            type: newFieldType,
            placeholder: newFieldPlaceholder.trim() || undefined,
            options: newFieldType === 'select' ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
            show_in_pos: true,
            show_in_table: true,
        };
        setValue("custom_product_fields", [...currentList, newField], { shouldDirty: true });
        setNewFieldName("");
        setNewFieldOptions("");
        setNewFieldPlaceholder("");
        setNewFieldType("text");
        toast.success(`Added attribute '${newField.name}'`);
    };

    const handleRemoveCustomField = (id: string) => {
        const currentList: CustomProductField[] = watch("custom_product_fields") || [];
        setValue("custom_product_fields", currentList.filter(f => f.id !== id), { shouldDirty: true });
        toast.info("Removed attribute field");
    };

    const handleResetToArchetypeFields = () => {
        const archetype = getArchetypeById(currentStore?.business_type);
        setValue("custom_product_fields", archetype.defaultCustomFields || [], { shouldDirty: true });
        toast.success(`Reset attributes to ${archetype.name} defaults`);
    };

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

                            {/* Card 4: Store Terminology & Metric Lexicon */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                        <Sliders className="w-4 h-4 text-primary" />
                                        <span>Product Terminology & Metrics</span>
                                    </div>
                                    <span className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                                        Dynamic Retail Model
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Configure how items, units, and inventory dimensions are named and displayed across your store.
                                </p>
                                <Separator />

                                {/* Quick Presets */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Fill from Industry Preset</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {INDUSTRY_ARCHETYPES.map((arch) => (
                                            <button
                                                key={arch.id}
                                                type="button"
                                                onClick={() => {
                                                    setValue("lexicon", arch.defaultLexicon, { shouldDirty: true });
                                                }}
                                                className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors font-medium flex items-center gap-1"
                                            >
                                                <span>{arch.name.split("&")[0].trim()}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Terminology inputs */}
                                <div className="grid gap-3 sm:grid-cols-3 pt-1">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="item_singular" className="text-xs font-medium">Item Singular *</Label>
                                        <Input
                                            id="item_singular"
                                            {...register("lexicon.item_singular", { required: true })}
                                            placeholder="e.g. Suit, Product, Article"
                                            className="h-9 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Buttons & single item labels</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="item_plural" className="text-xs font-medium">Item Plural *</Label>
                                        <Input
                                            id="item_plural"
                                            {...register("lexicon.item_plural", { required: true })}
                                            placeholder="e.g. Suits, Products, Articles"
                                            className="h-9 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Headers & catalog tables</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="primary_unit" className="text-xs font-medium">Primary Unit *</Label>
                                        <Input
                                            id="primary_unit"
                                            {...register("lexicon.primary_unit", { required: true })}
                                            placeholder="e.g. suits, pcs, pairs, kg"
                                            className="h-9 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Quantity badges & unit</p>
                                    </div>
                                </div>

                                {/* Secondary Metric Toggle */}
                                <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="enable_secondary_metric" className="text-sm font-medium cursor-pointer">
                                                Enable Secondary Dimension / Cut Metric
                                            </Label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Turn on if items have cut lengths or weight (e.g. Meters per Suit). Disabling hides extra measurement columns.
                                            </p>
                                        </div>
                                        <Switch
                                            id="enable_secondary_metric"
                                            checked={watch("lexicon.enable_secondary_metric") ?? false}
                                            onCheckedChange={(checked) => {
                                                setValue("lexicon.enable_secondary_metric", checked, { shouldDirty: true });
                                            }}
                                        />
                                    </div>

                                    {watch("lexicon.enable_secondary_metric") && (
                                        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="secondary_metric_name" className="text-xs font-medium">Metric Name</Label>
                                                <Input
                                                    id="secondary_metric_name"
                                                    {...register("lexicon.secondary_metric_name")}
                                                    placeholder="e.g. Meters, Rolls, Weight"
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="secondary_metric_symbol" className="text-xs font-medium">Metric Symbol / Abbr.</Label>
                                                <Input
                                                    id="secondary_metric_symbol"
                                                    {...register("lexicon.secondary_metric_symbol")}
                                                    placeholder="e.g. m, rolls, g"
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Allow Fractional Quantity */}
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3.5">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="allow_fractional_qty" className="text-sm font-medium cursor-pointer">
                                            Allow Fractional Quantities
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            Permits decimal entries (e.g. 2.5m, 1.25kg) on checkout and inventory.
                                        </p>
                                    </div>
                                    <Switch
                                        id="allow_fractional_qty"
                                        checked={watch("lexicon.allow_fractional_qty") ?? false}
                                        onCheckedChange={(checked) => {
                                            setValue("lexicon.allow_fractional_qty", checked, { shouldDirty: true });
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Card: Custom Product Specifications & Attributes */}
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                                        <Tags className="w-4 h-4 text-primary" />
                                        <span>Product Specifications & Custom Attributes</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleResetToArchetypeFields}
                                        className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Reset to Presets
                                    </Button>
                                </div>
                                <Separator />

                                <p className="text-xs text-muted-foreground">
                                    Configure custom attributes (e.g. Brand, Fabric Type, Season, Warranty, Expiry Date) that appear when creating products and in the catalog table.
                                </p>

                                {/* Existing Fields List */}
                                <div className="space-y-2">
                                    {(!watch("custom_product_fields") || watch("custom_product_fields")?.length === 0) ? (
                                        <div className="text-center py-6 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                                            No custom attributes configured yet. Add one below or reset to archetype presets.
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {watch("custom_product_fields")?.map((field) => (
                                                <div
                                                    key={field.id}
                                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-foreground">{field.name}</span>
                                                            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                                                                {field.type}
                                                            </Badge>
                                                            <span className="text-[11px] text-muted-foreground font-mono">
                                                                ({field.id})
                                                            </span>
                                                        </div>
                                                        {field.type === 'select' && field.options && field.options.length > 0 && (
                                                            <p className="text-[11px] text-muted-foreground truncate max-w-md">
                                                                Options: {field.options.join(", ")}
                                                            </p>
                                                        )}
                                                        {field.placeholder && (
                                                            <p className="text-[11px] text-muted-foreground">
                                                                Placeholder: &quot;{field.placeholder}&quot;
                                                            </p>
                                                        )}
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveCustomField(field.id)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add New Field Box */}
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5 text-primary" />
                                        Add New Specification Attribute
                                    </span>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="new_field_name" className="text-xs">Attribute Name</Label>
                                            <Input
                                                id="new_field_name"
                                                value={newFieldName}
                                                onChange={(e) => setNewFieldName(e.target.value)}
                                                placeholder="e.g. Fabric Type, Warranty, Season"
                                                className="h-8 text-xs bg-background"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="new_field_type" className="text-xs">Field Type</Label>
                                            <Select
                                                value={newFieldType}
                                                onValueChange={(val: any) => setNewFieldType(val)}
                                            >
                                                <SelectTrigger id="new_field_type" className="h-8 text-xs bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">Text Input</SelectItem>
                                                    <SelectItem value="number">Numeric</SelectItem>
                                                    <SelectItem value="select">Select Dropdown</SelectItem>
                                                    <SelectItem value="date">Date Picker</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {newFieldType === 'select' && (
                                        <div className="space-y-1">
                                            <Label htmlFor="new_field_options" className="text-xs">Dropdown Options (Comma-separated)</Label>
                                            <Input
                                                id="new_field_options"
                                                value={newFieldOptions}
                                                onChange={(e) => setNewFieldOptions(e.target.value)}
                                                placeholder="e.g. Lawn, Cotton, Karandi, Khaddar, Silk"
                                                className="h-8 text-xs bg-background"
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <Input
                                            value={newFieldPlaceholder}
                                            onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                                            placeholder="Optional input placeholder text..."
                                            className="h-8 text-xs bg-background flex-1"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddCustomField}
                                            className="h-8 text-xs gap-1 font-medium shrink-0"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Attribute
                                        </Button>
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
