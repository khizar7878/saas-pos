import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductImportDialogProps {
    onSuccess: () => void;
}

interface RawCsvRow {
    [key: string]: string;
}

interface ProcessedProduct {
    name: string;
    price: number;
    stock_quantity: number;
    meters_per_piece: number;
    category_name?: string;
    sku: string;
    barcode: string;
    pct_code: string;
    tax_rate: number;
    min_stock_level: number;
    raw: RawCsvRow;
    status: 'valid' | 'invalid';
    error?: string;
}

export function ProductImportDialog({ onSuccess }: ProductImportDialogProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [previewData, setPreviewData] = useState<ProcessedProduct[]>([]);
    const [defaultMeters, setDefaultMeters] = useState<string>("0");
    const [defaultMinStock, setDefaultMinStock] = useState<string>("5");
    const [step, setStep] = useState<'upload' | 'preview'>('upload');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const processCSV = () => {
        if (!file) return;

        setIsParsing(true);
        Papa.parse<RawCsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const processed: ProcessedProduct[] = results.data.map((row) => {
                    // Flexible mapping: generic names or specific expected keys
                    const name = row['Name'] || row['Product Name'] || row['name'] || '';
                    const priceStr = row['Price'] || row['Selling Price'] || row['sale_price'] || row['price'] || '0';
                    const stockStr = row['Stock'] || row['Quantity'] || row['stock_quantity'] || '0';
                    const category = row['Category'] || row['category'] || '';

                    const sku = row['sku'] || row['SKU'] || row['barcode'] || row['Barcode'] || row['Product ID'] || row['product_id'] || row['id'] || '';
                    const barcode = row['barcode'] || row['Barcode'] || '';
                    const pctCode = row['pct_code'] || row['PCT Code'] || row['pct'] || '';

                    const taxStr = row['tax_percentage'] || row['tax_rate'] || row['Tax'] || '0';
                    const minStockStr = row['min_stock_level'] || row['low_stock'] || row['Min Stock'] || defaultMinStock;
                    const metersStr = row['Meters per Suit'] || row['Meters'] || row['meters_per_piece'] || defaultMeters;

                    const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
                    const stock = parseInt(stockStr.replace(/[^0-9]/g, ''), 10) || 0;
                    const meters = parseFloat(metersStr.replace(/[^0-9.]/g, '')) || 0;
                    const taxRate = parseFloat(taxStr.replace(/[^0-9.]/g, '')) || 0;
                    const minStock = parseInt(minStockStr.replace(/[^0-9]/g, ''), 10) || 5;

                    let status: 'valid' | 'invalid' = 'valid';
                    let error = undefined;

                    if (!name) {
                        status = 'invalid';
                        error = 'Name is required';
                    } else if (price <= 0) {
                        status = 'invalid';
                        error = 'Invalid price';
                    }

                    return {
                        name,
                        price,
                        stock_quantity: stock,
                        meters_per_piece: meters,
                        category_name: category,
                        sku,
                        barcode,
                        pct_code: pctCode,
                        tax_rate: taxRate,
                        min_stock_level: minStock,
                        raw: row,
                        status,
                        error
                    };
                });

                setPreviewData(processed);
                setStep('preview');
                setIsParsing(false);
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message);
                setIsParsing(false);
            }
        });
    };

    const handleImport = async () => {
        const validProducts = previewData.filter(p => p.status === 'valid');
        if (validProducts.length === 0) {
            toast.error("No valid products to import");
            return;
        }

        setIsImporting(true);
        try {
            // 1. Handle Categories (Get existing or create new)
            const categoriesInImport = [...new Set(validProducts.map(p => p.category_name).filter(Boolean))];
            const categoryMap = new Map<string, string>(); // Name -> ID

            if (categoriesInImport.length > 0) {
                // Fetch existing
                const { data: existingCats } = await supabase
                    .from('product_categories')
                    .select('id, name');

                existingCats?.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

                // Create missing
                const missingCats = categoriesInImport.filter(c => !categoryMap.has(c!.toLowerCase()));

                for (const catName of missingCats) {
                    const { data: newCat } = await supabase
                        .from('product_categories')
                        .insert({ name: catName! })
                        .select()
                        .single();

                    if (newCat) {
                        categoryMap.set(catName!.toLowerCase(), newCat.id);
                    }
                }
            }

            // 2. Prepare Products Payload
            // Using batch insert size of 50 to be safe
            const productsToInsert = validProducts.map(p => ({
                name: p.name,
                price: p.price,
                stock_quantity: p.stock_quantity,
                meters_per_piece: p.meters_per_piece,
                category_id: p.category_name ? categoryMap.get(p.category_name.toLowerCase()) : null,
                sku: p.sku || null,
                barcode: p.barcode || null,
                pct_code: p.pct_code || null,
                tax_rate: p.tax_rate,
                min_stock_level: p.min_stock_level
            }));

            const BATCH_SIZE = 50;
            for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
                const batch = productsToInsert.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('products').insert(batch);
                if (error) throw error;
            }

            toast.success(`Successfully imported ${productsToInsert.length} products`);
            onSuccess();
            setOpen(false);

            // Reset state for next time
            setTimeout(() => {
                setStep('upload');
                setFile(null);
                setPreviewData([]);
            }, 300);

        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error("Import failed: " + error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const validCount = previewData.filter(p => p.status === 'valid').length;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Products</DialogTitle>
                    <DialogDescription>
                        Bulk import products from CSV. missing columns will use defaults.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden py-4">
                    {step === 'upload' ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                                <Label htmlFor="csv-upload" className="cursor-pointer">
                                    <span className="text-primary font-medium hover:underline">Click to upload</span>
                                    <span className="text-muted-foreground"> or drag and drop</span>
                                    <p className="text-xs text-muted-foreground mt-2">CSV files only</p>
                                </Label>
                                <Input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                {file && (
                                    <div className="mt-4 flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {file.name}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                                <div className="space-y-2">
                                    <Label>Default Meters per Suit</Label>
                                    <Input
                                        type="number"
                                        value={defaultMeters}
                                        onChange={(e) => setDefaultMeters(e.target.value)}
                                        placeholder="e.g. 4.0"
                                    />
                                    <p className="text-xs text-muted-foreground">Used if missing.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Default Low Stock Alert</Label>
                                    <Input
                                        type="number"
                                        value={defaultMinStock}
                                        onChange={(e) => setDefaultMinStock(e.target.value)}
                                        placeholder="e.g. 5"
                                    />
                                    <p className="text-xs text-muted-foreground">Used if missing.</p>
                                </div>
                            </div>

                            <div className="bg-muted p-4 rounded-lg text-xs space-y-2">
                                <p className="font-semibold">Expected Columns (Case Insensitive):</p>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                        <li>Name * (Product Name)</li>
                                        <li>Price * (Selling Price, sale_price)</li>
                                        <li>Stock (Quantity)</li>
                                        <li>Category</li>
                                    </ul>
                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                        <li>Barcode / SKU (product_id, id)</li>
                                        <li>Tax Percentage (tax_rate)</li>
                                        <li>PCT Code</li>
                                        <li>Meters per Suit</li>
                                        <li>Min Stock (low_stock, min_stock_level)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-lg">Preview</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Found {previewData.length} rows. {validCount} valid.
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>Back to Upload</Button>
                            </div>

                            {previewData.length > validCount && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Start Import Note</AlertTitle>
                                    <AlertDescription>
                                        {previewData.length - validCount} rows have errors and will be skipped.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex-1 border rounded-md overflow-hidden">
                                <ScrollArea className="h-[300px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>SKU/Barcode</TableHead>
                                                <TableHead>Price</TableHead>
                                                <TableHead>Tax %</TableHead>
                                                <TableHead>Meters</TableHead>
                                                <TableHead>Stock</TableHead>
                                                <TableHead>Min Stock</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>PCT Code</TableHead>
                                                <TableHead>Error</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.map((row, i) => (
                                                <TableRow key={i} className={row.status === 'invalid' ? 'bg-destructive/5' : ''}>
                                                    <TableCell>
                                                        {row.status === 'valid'
                                                            ? <CheckCircle2 className="w-4 h-4 text-success" />
                                                            : <AlertCircle className="w-4 h-4 text-destructive" />
                                                        }
                                                    </TableCell>
                                                    <TableCell className="font-medium">{row.name || '-'}</TableCell>
                                                    <TableCell className="text-xs font-mono">{row.barcode || row.sku || '-'}</TableCell>
                                                    <TableCell>{row.price}</TableCell>
                                                    <TableCell>{row.tax_rate}%</TableCell>
                                                    <TableCell>{row.meters_per_piece}</TableCell>
                                                    <TableCell>{row.stock_quantity}</TableCell>
                                                    <TableCell>{row.min_stock_level}</TableCell>
                                                    <TableCell>{row.category_name || '-'}</TableCell>
                                                    <TableCell>{row.pct_code || '-'}</TableCell>
                                                    <TableCell className="text-destructive text-xs">{row.error}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isParsing || isImporting}>
                        Cancel
                    </Button>
                    {step === 'upload' ? (
                        <Button onClick={processCSV} disabled={!file || isParsing}>
                            {isParsing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Review Data
                        </Button>
                    ) : (
                        <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
                            {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Import {validCount} Products
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
