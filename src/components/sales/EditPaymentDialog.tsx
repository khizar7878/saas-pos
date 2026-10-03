import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Banknote,
    ArrowRightLeft,
    BookOpen,
    CheckCircle2,
    Receipt,
    Building2,
    Loader2,
    Trash2,
    Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useBankAccounts, useBankNames } from "@/hooks/useAccounts";
import { useEditPayment } from "@/hooks/useEditPayment";
import { PaymentSplit } from "./CheckoutDialog";

interface EditPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    saleId: string | null;
    currentMethod: string | null;
    saleAmount: number;
}

const paymentMethods = [
    { id: "cash", label: "Cash", icon: Banknote, description: "Pay with cash" },
    { id: "ibft", label: "IBFT", icon: ArrowRightLeft, description: "Bank transfer" },
    { id: "card", label: "Card", icon: Building2, description: "Credit/Debit Card" },
    { id: "mixed", label: "Mixed", icon: ArrowRightLeft, description: "Split payment" },
];

export const EditPaymentDialog = ({
    open,
    onOpenChange,
    saleId,
    currentMethod,
    saleAmount,
}: EditPaymentDialogProps) => {
    const [selectedMethod, setSelectedMethod] = useState("cash");
    const [amountReceived, setAmountReceived] = useState(saleAmount.toString());
    const [selectedBankName, setSelectedBankName] = useState("");
    const [selectedBankAccount, setSelectedBankAccount] = useState("");

    // Mixed Payment State
    const [splits, setSplits] = useState<PaymentSplit[]>([
        { id: '1', method: 'cash', amount: 0 },
        { id: '2', method: 'cash', amount: 0 }
    ]);

    const { mutate: updatePayment, isPending } = useEditPayment();
    const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useBankAccounts();

    // Get unique bank names
    const uniqueBankNames = useMemo(() => {
        const banks = [...new Set(bankAccounts.map(acc => acc.bank_names?.name).filter(Boolean))] as string[];
        return banks.sort();
    }, [bankAccounts]);

    // Get accounts for selected bank
    const accountsForSelectedBank = useMemo(() => {
        if (!selectedBankName) return [];
        return bankAccounts.filter(acc => acc.bank_names?.name === selectedBankName);
    }, [selectedBankName, bankAccounts]);

    // Initial State Setup
    useEffect(() => {
        if (open) {
            setSelectedMethod(currentMethod || 'cash');
            setAmountReceived(saleAmount.toString());
            setSelectedBankName("");
            setSelectedBankAccount("");
            setSplits([
                { id: '1', method: 'cash', amount: 0 },
            ]);
        }
    }, [open, currentMethod, saleAmount]);

    // Mixed Logic
    const totalSplitAmount = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    const remainingSplitAmount = saleAmount - totalSplitAmount;
    const isMixedValid = selectedMethod === 'mixed' ? Math.abs(remainingSplitAmount) < 1 : true;

    const updateSplit = (id: string, field: keyof PaymentSplit, value: any) => {
        setSplits(prev => prev.map(split => {
            if (split.id === id) return { ...split, [field]: value };
            return split;
        }));
    };

    const addSplit = () => {
        setSplits(prev => [...prev, { id: Math.random().toString(), method: 'cash', amount: 0 }]);
    };

    const removeSplit = (id: string) => {
        if (splits.length > 1) {
            setSplits(prev => prev.filter(s => s.id !== id));
        }
    };

    // Change Calculation
    const change = parseFloat(amountReceived || "0") - saleAmount;

    // Validation

    const areSplitsValid = splits.every(split => {
        if (!split.amount || split.amount <= 0) return false;

        return true;
    });

    const isValid = selectedMethod === 'mixed'
        ? (isMixedValid && areSplitsValid)
        : true;

    const handleSubmit = () => {
        if (!saleId) return;

        updatePayment({
            saleId,
            newMethod: selectedMethod,
            amountReceived: parseFloat(amountReceived) || 0,
            bankAccountId: undefined,
            paymentSplits: selectedMethod === 'mixed' ? splits : undefined,
        }, {
            onSuccess: () => {
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-primary" />
                        Edit Payment Method
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Total Amount Display */}
                    <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-sm text-muted-foreground mb-1">Total Sale Amount</p>
                        <p className="text-3xl font-bold text-primary">
                            Rs. {saleAmount.toLocaleString()}
                        </p>
                    </div>

                    {/* Payment Method Grid */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">New Payment Method</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {paymentMethods.filter(m => m.id !== 'credit').map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setSelectedMethod(method.id)}
                                    className={cn(
                                        "p-3 rounded-xl border-2 transition-all text-center",
                                        selectedMethod === method.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <method.icon className={cn(
                                        "w-5 h-5 mx-auto mb-1",
                                        selectedMethod === method.id ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <p className={cn(
                                        "text-xs font-medium",
                                        selectedMethod === method.id ? "text-primary" : "text-foreground"
                                    )}>
                                        {method.label}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* Mixed Payment UI */}
                    {selectedMethod === "mixed" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Split payments</span>
                                <span className={cn(
                                    "font-medium",
                                    remainingSplitAmount === 0 ? "text-success" : "text-destructive"
                                )}>
                                    Remaining: Rs. {remainingSplitAmount.toLocaleString()}
                                </span>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {splits.map((split, index) => (
                                    <div key={split.id} className="p-3 bg-muted/30 border border-border rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">Payment {index + 1}</span>
                                            {splits.length > 1 && (
                                                <button onClick={() => removeSplit(split.id)} className="text-destructive p-1 rounded hover:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Method</Label>
                                                <Select value={split.method} onValueChange={(val) => updateSplit(split.id, 'method', val)}>
                                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">Cash</SelectItem>
                                                        <SelectItem value="card">Card</SelectItem>
                                                        <SelectItem value="ibft">IBFT</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Amount</Label>
                                                <Input
                                                    type="number"
                                                    value={split.amount || ''}
                                                    onChange={(e) => updateSplit(split.id, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="h-9"
                                                />
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>

                            <Button variant="outline" size="sm" onClick={addSplit} className="w-full border-dashed" disabled={splits.length >= 4}>
                                <Plus className="w-4 h-4 mr-2" /> Add Split Method
                            </Button>
                        </div>
                    )}

                    {/* Separator */}
                    {selectedMethod !== "mixed" && <Separator />}

                    {/* Amount Received (Cash & IBFT) */}
                    {(selectedMethod === "cash" || selectedMethod === "ibft") && (
                        <div className="space-y-3">
                            <Label htmlFor="amount" className="text-sm font-medium">Amount Received</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={amountReceived}
                                onChange={(e) => setAmountReceived(e.target.value)}
                                className="text-lg font-medium"
                            />
                            {change >= 0 && (
                                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                                    <span className="text-sm text-muted-foreground">Change (Cash)</span>
                                    <span className="font-semibold text-foreground">Rs. {change.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isPending} className="gap-2">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
