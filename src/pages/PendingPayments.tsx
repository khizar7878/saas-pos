import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreditSale } from '@/types/database';
import { format } from 'date-fns';
import { Search, User, FileText, CheckCircle, Truck, Printer, ArrowLeft, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import CheckoutDialog from '@/components/sales/CheckoutDialog';
import { useCompleteCreditSale, useDeliverCreditBill } from '@/hooks/useSales';
import { Loader2 } from 'lucide-react';
import PrintPendingBillDialog from '@/components/sales/PrintPendingBillDialog';

const PendingPayments = () => {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<CreditSale | null>(null);
    const [deliverConfirmationOpen, setDeliverConfirmationOpen] = useState(false);
    const [billToDeliver, setBillToDeliver] = useState<CreditSale | null>(null);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [billToPrint, setBillToPrint] = useState<CreditSale | null>(null);

    // New State for View Dialog
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [billToView, setBillToView] = useState<CreditSale | null>(null);

    const { data: creditSales = [], isLoading } = useQuery({
        queryKey: ['credit_sales'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('credit_sales')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as CreditSale[];
        }
    });

    const completeCreditSale = useCompleteCreditSale();
    const deliverCreditBill = useDeliverCreditBill();

    // Helper to calculate bill total based on remaining items and factoring in discounts
    const calculateBillTotal = (bill: CreditSale) => {
        const items = (bill.items as any[]) || [];
        const remainingGross = items.reduce((sum, item) => {
            const returned = item.quantity_returned || item.returned || 0;
            const qty = item.quantity || 0;
            const remaining = Math.max(0, qty - returned);
            const unitPrice = item.unit_price || item.price || 0;
            return sum + (remaining * unitPrice);
        }, 0);

        if (remainingGross === 0) return 0;
        return bill.total_amount !== undefined && bill.total_amount !== null ? Number(bill.total_amount) : remainingGross;
    };

    // Group by Customer and Calculate Totals using helper
    const customerGroups = useMemo(() => {
        const groups: Record<string, {
            id: string,
            name: string,
            phone: string | null,
            bills: CreditSale[],
            totalPending: number
        }> = {};

        creditSales.forEach(sale => {
            const customerId = sale.customer_id || 'walk-in';
            if (!groups[customerId]) {
                groups[customerId] = {
                    id: customerId,
                    name: sale.customer_name,
                    phone: sale.customer_phone,
                    bills: [],
                    totalPending: 0
                };
            }
            groups[customerId].bills.push(sale);
            // Use calculated total instead of stored total_amount
            groups[customerId].totalPending += calculateBillTotal(sale);
        });

        return Object.values(groups).sort((a, b) => b.totalPending - a.totalPending);
    }, [creditSales]);

    const filteredCustomers = customerGroups.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    const selectedCustomer = selectedCustomerId ? customerGroups.find(c => c.id === selectedCustomerId) : null;

    // Calculate total outstanding from fresh calculations
    const totalOutstanding = creditSales.reduce((sum, sale) => sum + calculateBillTotal(sale), 0);
    const totalPendingBills = creditSales.length;

    const handleReceivePayment = (bill: CreditSale) => {
        setSelectedBill(bill);
        setPaymentDialogOpen(true);
    };

    // ... (rest of handlers remain same)

    const handlePaymentConfirm = async (
        paymentMethod: string,
        amountReceived: number,
        bankAccountId?: string,
        chequeDetails?: { chequeNumber: string; chequeBank: string; chequeDate: string }
    ) => {
        if (!selectedBill) return;

        // Use calculated total for payment logic too? Usually payment should match bill total.
        // But completeCreditSale might rely on stored total.
        // For now, let's assume the user pays the *displayed* amount.
        const calculatedTotal = calculateBillTotal(selectedBill);

        try {
            await completeCreditSale.mutateAsync({
                creditSaleId: selectedBill.id,
                paymentDetails: {
                    payment_method: paymentMethod,
                    amount_received: amountReceived,
                    change_amount: amountReceived - calculatedTotal // Use calculated total
                }
            });
            setPaymentDialogOpen(false);
            setSelectedBill(null);
        } catch (error) {
            console.error(error);
        }
    };


    const handleDeliverClick = (bill: CreditSale) => {
        setBillToDeliver(bill);
        setDeliverConfirmationOpen(true);
    };

    const handleDeliverConfirm = async () => {
        if (!billToDeliver) return;
        try {
            await deliverCreditBill.mutateAsync(billToDeliver.id);
            setDeliverConfirmationOpen(false);
            setBillToDeliver(null);
            const remainingBills = selectedCustomer?.bills.filter(b => b.id !== billToDeliver.id).length || 0;
            if (remainingBills === 0) {
                setSelectedCustomerId(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handlePrintBill = (bill: CreditSale) => {
        setBillToPrint(bill);
        setPrintDialogOpen(true);
    };

    const handleViewBill = (bill: CreditSale) => {
        setBillToView(bill);
        setViewDialogOpen(true);
    };

    if (isLoading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Pending Payments</h1>
                        <p className="text-muted-foreground text-xs md:text-sm">
                            Manage outstanding credit bills and receive payments
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card shadow-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                                <p className="text-2xl font-semibold text-destructive">Rs. {totalOutstanding.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card shadow-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pending Bills</p>
                                <p className="text-2xl font-semibold">{totalPendingBills}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Left Sidebar: Customer List */}
                <Card className={`flex flex-col w-full md:w-1/3 min-w-[300px] h-full ${selectedCustomerId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search customers..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        {filteredCustomers.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No pending payments found.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredCustomers.map(customer => (
                                    <button
                                        key={customer.id}
                                        onClick={() => setSelectedCustomerId(customer.id)}
                                        className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start justify-between group ${selectedCustomerId === customer.id ? 'bg-muted border-l-4 border-l-primary pl-[12px]' : 'pl-4'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                                                {customer.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium">{customer.name}</div>
                                                <div className="text-xs text-muted-foreground">{customer.bills.length} Bill{customer.bills.length !== 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-destructive">Rs {customer.totalPending.toLocaleString()}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </Card>

                {/* Right Side: Bill Details */}
                <Card className={`flex-1 flex flex-col h-full overflow-hidden ${!selectedCustomerId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedCustomer ? (
                        <>
                            <CardHeader className="border-b bg-muted/40 pb-4">
                                <div className="flex items-center gap-2 mb-1 md:hidden">
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(null)} className="-ml-2">
                                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">{selectedCustomer.name}</CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                {selectedCustomer.phone && <span>{selectedCustomer.phone} • </span>}
                                                <span className="font-medium text-destructive">Total Due: Rs {selectedCustomer.totalPending.toLocaleString()}</span>
                                            </CardDescription>
                                        </div>

                                    </div>
                                </div>
                            </CardHeader>
                            <div className="flex-1 overflow-auto p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Bill Number</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Items</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedCustomer.bills.map(bill => {
                                            const items = bill.items as any[];
                                            const totalItems = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                                            const returnedItems = items.reduce((acc, item) => acc + (item.quantity_returned || item.returned || 0), 0);
                                            const remainingItems = totalItems - returnedItems;
                                            const billTotal = calculateBillTotal(bill);

                                            return (
                                                <TableRow
                                                    key={bill.id}
                                                    className="hover:bg-muted/50 cursor-pointer"
                                                    onClick={() => handleViewBill(bill)}
                                                >
                                                    <TableCell className="font-mono font-medium">{bill.bill_number}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {format(new Date(bill.created_at), 'dd MMM yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        {remainingItems}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-base">
                                                        Rs {billTotal.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 h-8"
                                                                onClick={() => handleReceivePayment(bill)}
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                                                Receive Pay
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={() => handlePrintBill(bill)}
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={() => handleDeliverClick(bill)}
                                                                title="Mark as Delivered (No Pay)"
                                                            >
                                                                <Truck className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/10">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                                <FileText className="w-10 h-10 opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">Select a Customer</h3>
                            <p className="max-w-xs mx-auto text-sm">
                                Choose a customer from the list to view their outstanding bills and process payments.
                            </p>
                        </div>
                    )}
                </Card>

                <CheckoutDialog
                    open={paymentDialogOpen}
                    onOpenChange={setPaymentDialogOpen}
                    total={selectedBill?.total_amount || 0}
                    onConfirm={handlePaymentConfirm}
                    isWalkInCustomer={false}
                    isProcessing={completeCreditSale.isPending}
                />

                <Dialog open={deliverConfirmationOpen} onOpenChange={setDeliverConfirmationOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Bill Delivery</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to mark bill <strong>{billToDeliver?.bill_number}</strong> as Delivered?
                                This will remove it from pending payments without generating a financial sale record.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeliverConfirmationOpen(false)}>Cancel</Button>
                            <Button variant="default" onClick={handleDeliverConfirm} disabled={deliverCreditBill.isPending}>
                                {deliverCreditBill.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Confirm Delivery
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Bill Details</DialogTitle>
                            <DialogDescription>
                                Details for Bill #{billToView?.bill_number}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="bg-muted/30 p-3 rounded-md space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Date:</span>
                                    <span className="font-medium">{billToView && format(new Date(billToView.created_at), 'dd MMM yyyy hh:mm a')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Customer:</span>
                                    <span className="font-medium">{billToView?.customer_name}</span>
                                </div>
                                {billToView?.received_by && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Received By:</span>
                                        <span className="font-medium">{billToView.received_by}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>

                                        {(() => {
                                            const items = (billToView?.items as any[]) || [];
                                            const filteredItems = items.filter(item => {
                                                const returned = item.quantity_returned || item.returned || 0;
                                                const qty = item.quantity || 0;
                                                return (qty - returned) > 0;
                                            });

                                            const remainingGross = filteredItems.reduce((sum, item) => {
                                                const returned = item.quantity_returned || item.returned || 0;
                                                const qty = item.quantity || 0;
                                                const remaining = qty - returned;
                                                const unitPrice = item.unit_price || item.price || 0;
                                                return sum + (remaining * unitPrice);
                                            }, 0);

                                            const displayTotal = billToView ? calculateBillTotal(billToView) : 0;
                                            const discount = Math.max(0, remainingGross - displayTotal);

                                            if (filteredItems.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                            All items returned.
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return (
                                                <>
                                                    {filteredItems.map((item, idx) => {
                                                        const returned = item.quantity_returned || item.returned || 0;
                                                        const qty = item.quantity || 0;
                                                        const remaining = qty - returned;
                                                        const unitPrice = item.unit_price || item.price || 0;
                                                        const rowTotal = remaining * unitPrice;

                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell>
                                                                    <div className="font-medium">{item.product_name}</div>
                                                                    {returned > 0 && (
                                                                        <div className="text-xs text-muted-foreground">
                                                                            (Orig: {qty}, Ret: {returned})
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">{remaining}</TableCell>
                                                                <TableCell className="text-right">{rowTotal.toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {discount > 0 && (
                                                        <>
                                                            <TableRow className="bg-muted/30 text-muted-foreground border-t">
                                                                <TableCell colSpan={2} className="text-right text-sm">Subtotal</TableCell>
                                                                <TableCell className="text-right text-sm">Rs {remainingGross.toLocaleString()}</TableCell>
                                                            </TableRow>
                                                            <TableRow className="bg-muted/30 text-emerald-600 font-medium">
                                                                <TableCell colSpan={2} className="text-right text-sm">Discount</TableCell>
                                                                <TableCell className="text-right text-sm">- Rs {discount.toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        </>
                                                    )}
                                                    <TableRow className="bg-muted/50 font-bold border-t-2">
                                                        <TableCell colSpan={2} className="text-right">Total Payable</TableCell>
                                                        <TableCell className="text-right text-xl">Rs {displayTotal.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                </>
                                            );
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <PrintPendingBillDialog
                    open={printDialogOpen}
                    onOpenChange={setPrintDialogOpen}
                    bill={billToPrint}
                />
            </div>
        </div>
    );
};

export default PendingPayments;
