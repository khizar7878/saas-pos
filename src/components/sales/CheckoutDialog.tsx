import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  FileText,
  Plus,
  Trash2,
  CreditCard,
  Smartphone
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

export interface ChequeDetails {
  chequeNumber: string;
  chequeBank: string;
  chequeDate: string;
}

export interface PaymentSplit {
  id: string;
  method: string;
  amount: number;
  bankAccountId?: string;
  chequeDetails?: ChequeDetails;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirm: (
    paymentMethod: string,
    amountReceived: number,
    bankAccountId?: string,
    chequeDetails?: ChequeDetails,
    paymentSplits?: PaymentSplit[],
    receivedBy?: string
  ) => void | Promise<void>;
  isWalkInCustomer?: boolean;
  isProcessing?: boolean;
}

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Banknote, description: "Pay with cash" },
  { id: "ibft", label: "IBFT", icon: Smartphone, description: "Bank transfer" },
  { id: "card", label: "Card", icon: CreditCard, description: "Credit/Debit Card" },
  { id: "credit", label: "Credit", icon: BookOpen, description: "Add to account" },
  { id: "mixed", label: "Mixed", icon: ArrowRightLeft, description: "Split payment" },
];

const CheckoutDialog = ({ open, onOpenChange, total, onConfirm, isWalkInCustomer = true, isProcessing = false }: CheckoutDialogProps) => {
  const [selectedMethod, setSelectedMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState(total.toString());
  const [selectedBankName, setSelectedBankName] = useState("");
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");

  // Mixed Payment State
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { id: '1', method: 'cash', amount: 0 },
    { id: '2', method: 'cash', amount: 0 }
  ]);

  // Cheque details
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useBankAccounts();
  const { data: bankNames = [], isLoading: bankNamesLoading } = useBankNames();

  // Filter out credit option for walk-in customers
  const availableMethods = useMemo(() => isWalkInCustomer
    ? paymentMethods.filter(m => m.id !== "credit")
    : paymentMethods, [isWalkInCustomer]);

  // Methods valid inside a split (exclude 'mixed' and 'credit' typically)
  const splitMethods = useMemo(() => availableMethods.filter(m => m.id !== 'mixed' && m.id !== 'credit'), [availableMethods]);

  // Get unique bank names from real accounts
  const uniqueBankNames = useMemo(() => {
    const banks = [...new Set(bankAccounts.map(acc => acc.bank_names?.name).filter(Boolean))] as string[];
    return banks.sort();
  }, [bankAccounts]);

  // Get accounts for selected bank
  const accountsForSelectedBank = useMemo(() => {
    if (!selectedBankName) return [];
    return bankAccounts.filter(acc => acc.bank_names?.name === selectedBankName);
  }, [selectedBankName, bankAccounts]);

  // Reset selected method if it becomes unavailable
  useEffect(() => {
    if (isWalkInCustomer && selectedMethod === "credit") {
      setSelectedMethod("cash");
    }
  }, [isWalkInCustomer, selectedMethod]);

  // Reset bank account when bank name changes
  useEffect(() => {
    setSelectedBankAccount("");
  }, [selectedBankName]);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setAmountReceived(total.toString());
      setSelectedBankName("");
      setSelectedBankAccount("");
      setIsSubmitting(false);
      setChequeNumber("");
      setChequeBank("");
      setChequeDate("");
      setReceivedBy("");
      // Reset splits with total divided equally initially
      setSplits([
        { id: '1', method: 'cash', amount: 0 },
      ]);
    }
  }, [open, total]);

  // Ensure body pointer events are restored when dialog unmounts
  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = '';
    };
  }, []);

  // Mixed Payment Logic
  const totalSplitAmount = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
  const remainingSplitAmount = total - totalSplitAmount;
  const isMixedValid = selectedMethod === 'mixed' ? Math.abs(remainingSplitAmount) < 1 : true;

  const updateSplit = (id: string, field: keyof PaymentSplit, value: any) => {
    setSplits(prev => prev.map(split => {
      if (split.id === id) {
        return { ...split, [field]: value };
      }
      return split;
    }));
  };

  const addSplit = () => {
    setSplits(prev => [
      ...prev,
      { id: Math.random().toString(), method: 'cash', amount: 0 }
    ]);
  };

  const removeSplit = (id: string) => {
    if (splits.length > 1) {
      setSplits(prev => prev.filter(s => s.id !== id));
    }
  };

  const change = parseFloat(amountReceived || "0") - total;
  const processing = isProcessing || isSubmitting;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const chequeDetails = undefined;

      await Promise.resolve(
        onConfirm(
          selectedMethod,
          parseFloat(amountReceived || "0"),
          selectedBankAccount || undefined,
          chequeDetails,
          selectedMethod === 'mixed' ? splits : undefined,
          selectedMethod === 'credit' ? receivedBy : undefined
        )
      );
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccount);


  const isChequeValid = selectedMethod !== "cheque" || (chequeNumber && chequeBank && chequeDate);

  // Validate Splits
  const areSplitsValid = splits.every(split => {
    if (!split.amount || split.amount <= 0) return false;

    return true;
  });

  // Also check total match
  const isTotalMatched = Math.abs(remainingSplitAmount) < 1;

  // In Retail POS, IBFT doesn't require bank account selection (removed feature)
  // IBFT works like cash - just amount received
  const isIbftValid = true;

  const isValid = selectedMethod === 'mixed'
    ? (isMixedValid && areSplitsValid && isTotalMatched)
    : (isIbftValid && isChequeValid);

  // Refs for keyboard navigation
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const addSplitBtnRef = useRef<HTMLButtonElement>(null);
  const quickAmountRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const paymentMethodRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const splitMethodRefs = useRef<(HTMLButtonElement | null)[]>([]); // To focus Select trigger
  const splitAmountRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus on first payment method when dialog opens
  useEffect(() => {
    if (open && !processing) {
      // Small timeout to ensure DOM is ready
      setTimeout(() => {
        paymentMethodRefs.current[0]?.focus();
      }, 50);
    }
  }, [open, processing]);

  // Quick Amounts Logic
  const quickAmounts = useMemo(() => {
    if (total % 5000 === 0) return [total];

    const amounts = [
      total, // Exact
      Math.ceil(total / 500) * 500, // Next 500
      Math.ceil(total / 1000) * 1000, // Next 1000
      Math.ceil(total / 5000) * 5000, // Next 5000
    ];

    // Deduplicate and sort
    return [...new Set(amounts)].sort((a, b) => a - b);
  }, [total]);

  // Keyboard Handlers
  const handlePaymentMethodKeyDown = (e: React.KeyboardEvent, methodId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setSelectedMethod(methodId);

      // If Cash, move to first quick amount
      if (methodId === 'cash') {
        setTimeout(() => quickAmountRefs.current[0]?.focus(), 0);
      } else if (methodId === 'mixed') {
        setTimeout(() => splitMethodRefs.current[0]?.focus(), 0);
      } else if (methodId === 'card') {
        setTimeout(() => confirmBtnRef.current?.focus(), 0);
      } else {
        // Move to input or other logic for other methods
        setTimeout(() => amountInputRef.current?.focus(), 0);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const index = availableMethods.findIndex(m => m.id === methodId);
      const nextIndex = (index + 1) % availableMethods.length;
      paymentMethodRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const index = availableMethods.findIndex(m => m.id === methodId);
      const prevIndex = (index - 1 + availableMethods.length) % availableMethods.length;
      paymentMethodRefs.current[prevIndex]?.focus();
    }
  };

  const handleQuickAmountKeyDown = (e: React.KeyboardEvent, amount: number, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setAmountReceived(amount.toString());
      confirmBtnRef.current?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < quickAmounts.length) {
        quickAmountRefs.current[nextIndex]?.focus();
      } else {
        amountInputRef.current?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        quickAmountRefs.current[prevIndex]?.focus();
      } else {
        // Move back to payment methods? Or verify flow. 
        // User said: "cursor can be moved in between the amounts and the manual amount input using the tab key"
        // Arrow keys are also good for UX within a group.
      }
    }
  };

  // Input Key Down
  const handleAmountInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmBtnRef.current?.focus();
    }
  };

  const handleSplitMethodKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Wait a tick in case select is opening/closing, or just move to amount input directly
      setTimeout(() => splitAmountRefs.current[index]?.focus(), 0);
    }
  };

  const handleSplitAmountKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Are we matching total?
      const remaining = Math.abs(total - splits.reduce((sum, split) => sum + (split.amount || 0), 0));
      const hasReachedTotal = remaining < 1;

      if (hasReachedTotal) {
        confirmBtnRef.current?.focus();
      } else if (index === splits.length - 1 && splits.length < 4) {
        // Move to Add Split Button
        addSplitBtnRef.current?.focus();
      } else if (index < splits.length - 1) {
        // Move to next split method
        splitMethodRefs.current[index + 1]?.focus();
      }
    }
  };


  return (
    <Dialog open={open} onOpenChange={(value) => !processing && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden data-[state=closed]:duration-0 data-[state=closed]:animate-none">
        <div className="relative">
          {/* Processing Overlay (inside dialog) */}
          {processing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3 z-50 animate-fade-in">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Processing Sale...</p>
              <p className="text-xs text-muted-foreground">Please wait</p>
            </div>
          )}

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Complete Checkout
            </DialogTitle>
            <DialogDescription>
              Select payment method and confirm the sale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Total Amount */}
            <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-primary">
                Rs. {total.toLocaleString()}
              </p>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Payment Method</Label>
              <div className={cn(
                "gap-2",
                availableMethods.length === 5 
                  ? "flex flex-wrap justify-center sm:gap-3" 
                  : `grid ${availableMethods.length <= 3 ? 'grid-cols-' + availableMethods.length : 'grid-cols-2 sm:grid-cols-4'}`
              )}>
                {availableMethods.map((method, index) => (
                  <button
                    key={method.id}
                    ref={el => paymentMethodRefs.current[index] = el}
                    onClick={() => setSelectedMethod(method.id)}
                    onKeyDown={(e) => handlePaymentMethodKeyDown(e, method.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all text-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      availableMethods.length === 5 && "flex-1 basis-[100px] max-w-[130px]",
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
              {isWalkInCustomer && (
                <p className="text-xs text-muted-foreground">
                  Credit sales are only available for registered customers
                </p>
              )}
            </div>

            {/* Mixed Payment UI */}
            {selectedMethod === "mixed" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Split payments across methods</span>
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
                          <button
                            onClick={() => removeSplit(split.id)}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={split.method}
                            onValueChange={(val) => updateSplit(split.id, 'method', val)}
                          >
                            <SelectTrigger 
                              className="h-9" 
                              ref={el => splitMethodRefs.current[index] = el as any}
                              onKeyDown={(e) => handleSplitMethodKeyDown(e, index)}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {splitMethods.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            ref={el => splitAmountRefs.current[index] = el}
                            value={split.amount || ''}
                            onChange={(e) => updateSplit(split.id, 'amount', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleSplitAmountKeyDown(e, index)}
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* Cheque Details for Split */}
                      {split.method === 'cheque' && (
                        <div className="grid gap-2 pt-2 border-t border-border/50">
                          <Input
                            placeholder="Cheque #"
                            className="h-8 text-xs"
                            value={split.chequeDetails?.chequeNumber || ''}
                            onChange={(e) => updateSplit(split.id, 'chequeDetails', { ...split.chequeDetails, chequeNumber: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Bank"
                              className="h-8 text-xs"
                              value={split.chequeDetails?.chequeBank || ''}
                              onChange={(e) => updateSplit(split.id, 'chequeDetails', { ...split.chequeDetails, chequeBank: e.target.value })}
                            />
                            <Input
                              type="date"
                              className="h-8 text-xs"
                              value={split.chequeDetails?.chequeDate || ''}
                              onChange={(e) => updateSplit(split.id, 'chequeDetails', { ...split.chequeDetails, chequeDate: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  ref={addSplitBtnRef}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addSplit();
                    // Once state updates, focus the new select method
                    setTimeout(() => splitMethodRefs.current[splits.length]?.focus(), 50);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSplit();
                      setTimeout(() => splitMethodRefs.current[splits.length]?.focus(), 50);
                    }
                  }}
                  className="w-full border-dashed"
                  disabled={splits.length >= 4}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Split Method
                </Button>
              </div>
            )}

            {/* Separator */}
            {selectedMethod !== "mixed" && <Separator />}

            {/* Quick Amounts (Now Above Input) */}
            {selectedMethod === "cash" && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Quick Amount</Label>
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((amount, i) => (
                    <Button
                      key={i}
                      ref={el => quickAmountRefs.current[i] = el}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAmountReceived(amount.toString());
                        confirmBtnRef.current?.focus();
                      }}
                      onKeyDown={(e) => handleQuickAmountKeyDown(e, amount, i)}
                      className={cn(
                        parseFloat(amountReceived) === amount && "border-primary bg-primary/5"
                      )}
                    >
                      Rs. {amount.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Received By (for credit) */}
            {selectedMethod === "credit" && (
              <div className="space-y-3">
                <Label htmlFor="receivedBy" className="text-sm font-medium">
                  Received By
                </Label>
                <Input
                  id="receivedBy"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="text-base"
                  placeholder="Enter name of person receiving (optional)"
                />
              </div>
            )}

            {/* Amount Received (for cash and IBFT) */}
            {(selectedMethod === "cash" || selectedMethod === "ibft") && (
              <div className="space-y-3">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Amount Received
                </Label>
                <Input
                  id="amount"
                  ref={amountInputRef}
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  onKeyDown={handleAmountInputKeyDown}
                  className="text-lg font-medium"
                  placeholder="Enter amount"
                />
                {change >= 0 && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-sm text-muted-foreground">Change (Cash)</span>
                    <span className="font-semibold text-foreground">
                      Rs. {change.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
              ref={cancelBtnRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') confirmBtnRef.current?.focus();
              }}
            >
              Cancel
            </Button>
            <Button
              ref={confirmBtnRef}
              onClick={handleConfirm}
              className="gap-2"
              disabled={!isValid || processing}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') cancelBtnRef.current?.focus();
              }}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {processing ? "Processing..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;