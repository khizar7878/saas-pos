// Industry Archetypes, Lexicon, and Extensible Product Attribute Definitions for SaaS Multi-Tenant POS

export interface StoreLexicon {
  item_singular: string;            // e.g. "Suit", "Product", "Article", "Device", "Pair"
  item_plural: string;              // e.g. "Suits", "Products", "Articles", "Devices", "Pairs"
  primary_unit: string;             // e.g. "suits", "pcs", "pairs", "kg", "meters"
  secondary_metric_name?: string | null;  // e.g. "Meters", "Rolls", "Weight", null
  secondary_metric_symbol?: string | null; // e.g. "m", "kg", null
  enable_secondary_metric: boolean; // if false: completely hide secondary metric columns and calculations
  allow_fractional_qty: boolean;    // if true: allows decimal numbers like 2.5 on POS
}

export interface CustomProductField {
  id: string;              // e.g. "brand", "fabric_type", "season", "warranty_months", "expiry_date", "model"
  name: string;            // e.g. "Brand", "Fabric Type", "Season", "Warranty", "Expiry Date", "Model"
  type: "text" | "number" | "select" | "date" | "boolean";
  options?: string[];      // For "select" fields
  placeholder?: string;
  required?: boolean;
  show_in_pos?: boolean;
  show_in_table?: boolean;
}

export interface IndustryArchetype {
  id: string;
  name: string;
  category: string;
  description: string;
  badge: string;
  iconName: string;
  defaultLexicon: StoreLexicon;
  defaultCustomFields: CustomProductField[];
}

export const DEFAULT_RETAIL_LEXICON: StoreLexicon = {
  item_singular: "Product",
  item_plural: "Products",
  primary_unit: "pcs",
  secondary_metric_name: null,
  secondary_metric_symbol: null,
  enable_secondary_metric: false,
  allow_fractional_qty: false
};

export const INDUSTRY_ARCHETYPES: IndustryArchetype[] = [
  {
    id: "general_retail",
    name: "General Retail & Supermarket",
    category: "General",
    description: "Standard barcode retail for packaged goods, departmental items, and mini-marts",
    badge: "Most Common",
    iconName: "Store",
    defaultLexicon: {
      item_singular: "Product",
      item_plural: "Products",
      primary_unit: "pcs",
      secondary_metric_name: null,
      secondary_metric_symbol: null,
      enable_secondary_metric: false,
      allow_fractional_qty: false
    },
    defaultCustomFields: [
      { id: "brand", name: "Brand", type: "text", placeholder: "e.g. Brand Name", required: false, show_in_pos: true, show_in_table: true }
    ]
  },
  {
    id: "fabrics",
    name: "Textiles & Unstitched Suits",
    category: "Fabrics & Fashion",
    description: "Fabrics retailing unstitched suits with specific cut lengths (meters) and color swatches",
    badge: "Fabric Specialist",
    iconName: "Scissors",
    defaultLexicon: {
      item_singular: "Suit",
      item_plural: "Suits",
      primary_unit: "suits",
      secondary_metric_name: "Meters",
      secondary_metric_symbol: "m",
      enable_secondary_metric: true,
      allow_fractional_qty: false
    },
    defaultCustomFields: [
      { id: "fabric_type", name: "Fabric Type", type: "select", options: ["Cotton", "Wash & Wear", "Boski", "Karandi", "Khaddar", "Lawn", "Silk", "Wool", "Linen"], placeholder: "Select fabric type", required: false, show_in_pos: true, show_in_table: true },
      { id: "season", name: "Season", type: "select", options: ["Summer", "Winter", "Mid-Season", "All Season"], placeholder: "Select season", required: false, show_in_pos: true, show_in_table: true },
      { id: "pana", name: "Pana / Width (Inches)", type: "number", placeholder: "e.g. 54 or 58", required: false, show_in_pos: false, show_in_table: false },
      { id: "brand", name: "Brand / Mill", type: "text", placeholder: "e.g. Grace, Pasha, Ahmad", required: false, show_in_pos: true, show_in_table: true }
    ]
  },
  {
    id: "fabric_rolls",
    name: "Cut-to-Order Fabrics & Drapery",
    category: "Fabrics & Fashion",
    description: "Rolls/Thaan fabric selling exact custom lengths (e.g. 2.75m, 6m) cut from bulk rolls",
    badge: "By The Meter",
    iconName: "Ruler",
    defaultLexicon: {
      item_singular: "Fabric",
      item_plural: "Fabrics",
      primary_unit: "meters",
      secondary_metric_name: "Rolls",
      secondary_metric_symbol: "rolls",
      enable_secondary_metric: true,
      allow_fractional_qty: true
    },
    defaultCustomFields: [
      { id: "material", name: "Material Composition", type: "text", placeholder: "e.g. 100% Linen", required: false, show_in_pos: true, show_in_table: true },
      { id: "width", name: "Roll Width (Inches)", type: "number", placeholder: "e.g. 60", required: false, show_in_pos: false, show_in_table: false },
      { id: "pattern", name: "Pattern", type: "select", options: ["Solid / Plain", "Printed", "Jacquard", "Embroidered", "Striped"], placeholder: "Select pattern", required: false, show_in_pos: true, show_in_table: true }
    ]
  },
  {
    id: "apparel",
    name: "Fashion Apparel & Boutiques",
    category: "Fabrics & Fashion",
    description: "Ready-to-wear clothing, pret, shirts, trousers, and garments",
    badge: "Ready to Wear",
    iconName: "Shirt",
    defaultLexicon: {
      item_singular: "Article",
      item_plural: "Articles",
      primary_unit: "pcs",
      secondary_metric_name: null,
      secondary_metric_symbol: null,
      enable_secondary_metric: false,
      allow_fractional_qty: false
    },
    defaultCustomFields: [
      { id: "brand", name: "Brand", type: "text", placeholder: "e.g. Zara, Outfitters", required: false, show_in_pos: true, show_in_table: true },
      { id: "gender", name: "Gender / Dept", type: "select", options: ["Men", "Women", "Boys", "Girls", "Unisex"], placeholder: "Select gender", required: false, show_in_pos: true, show_in_table: true },
      { id: "material", name: "Material", type: "text", placeholder: "e.g. 100% Cotton, Denim", required: false, show_in_pos: false, show_in_table: false },
      { id: "fit", name: "Fit Style", type: "select", options: ["Regular Fit", "Slim Fit", "Relaxed Fit", "Oversized"], placeholder: "Select fit", required: false, show_in_pos: true, show_in_table: true }
    ]
  },
  {
    id: "footwear",
    name: "Footwear & Shoes",
    category: "Lifestyle",
    description: "Shoe retail, sandals, boots, and leather goods sold by pairs and sizes",
    badge: "By Pair",
    iconName: "Footprints",
    defaultLexicon: {
      item_singular: "Pair",
      item_plural: "Pairs",
      primary_unit: "pairs",
      secondary_metric_name: null,
      secondary_metric_symbol: null,
      enable_secondary_metric: false,
      allow_fractional_qty: false
    },
    defaultCustomFields: [
      { id: "brand", name: "Brand", type: "text", placeholder: "e.g. Nike, Service, Bata", required: false, show_in_pos: true, show_in_table: true },
      { id: "gender", name: "Gender", type: "select", options: ["Men", "Women", "Kids", "Unisex"], placeholder: "Select gender", required: false, show_in_pos: true, show_in_table: true },
      { id: "upper_material", name: "Upper Material", type: "select", options: ["Genuine Leather", "Synthetic", "Canvas", "Mesh", "Suede"], placeholder: "Select material", required: false, show_in_pos: false, show_in_table: false }
    ]
  },
  {
    id: "electronics",
    name: "Electronics, Mobile & Tech",
    category: "Electronics",
    description: "Phones, accessories, hardware, electronics with warranty and specs",
    badge: "Tech & Mobile",
    iconName: "Smartphone",
    defaultLexicon: {
      item_singular: "Device",
      item_plural: "Devices",
      primary_unit: "pcs",
      secondary_metric_name: null,
      secondary_metric_symbol: null,
      enable_secondary_metric: false,
      allow_fractional_qty: false
    },
    defaultCustomFields: [
      { id: "brand", name: "Brand / Manufacturer", type: "text", placeholder: "e.g. Samsung, Apple, Sony", required: false, show_in_pos: true, show_in_table: true },
      { id: "model", name: "Model / Specs", type: "text", placeholder: "e.g. Galaxy S24, 256GB", required: false, show_in_pos: true, show_in_table: true },
      { id: "warranty", name: "Warranty Period", type: "text", placeholder: "e.g. 1 Year Official Warranty", required: false, show_in_pos: true, show_in_table: true }
    ]
  },
  {
    id: "grocery",
    name: "Grocery & Weighing Scale",
    category: "Food & Beverage",
    description: "Groceries, sweets, nuts, and produce sold by weight (kg/g) with fractional quantities",
    badge: "Scale & Weight",
    iconName: "Scale",
    defaultLexicon: {
      item_singular: "Item",
      item_plural: "Items",
      primary_unit: "kg",
      secondary_metric_name: null,
      secondary_metric_symbol: null,
      enable_secondary_metric: false,
      allow_fractional_qty: true
    },
    defaultCustomFields: [
      { id: "brand", name: "Brand / Packager", type: "text", placeholder: "e.g. National, Nestle", required: false, show_in_pos: true, show_in_table: true },
      { id: "expiry_date", name: "Expiry Date", type: "date", required: false, show_in_pos: false, show_in_table: true },
      { id: "batch_no", name: "Batch / Lot #", type: "text", placeholder: "e.g. B-2026-04", required: false, show_in_pos: false, show_in_table: false }
    ]
  }
];

export const getArchetypeById = (id?: string | null): IndustryArchetype => {
  return INDUSTRY_ARCHETYPES.find(a => a.id === id) || INDUSTRY_ARCHETYPES[0];
};
