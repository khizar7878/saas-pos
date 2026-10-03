import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaymentSplit } from "@/components/sales/CheckoutDialog";

interface UpdatePaymentMethodParams {
    saleId: string;
    newMethod: string;
    amountReceived: number;
    bankAccountId?: string;
    paymentSplits?: PaymentSplit[];
}

export const useEditPayment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ saleId, newMethod, amountReceived, bankAccountId, paymentSplits }: UpdatePaymentMethodParams) => {
            const { data, error } = await supabase.rpc('update_sale_payment_method', {
                p_sale_id: saleId,
                p_new_method: newMethod,
                p_amount_received: amountReceived,
                p_new_account_id: bankAccountId || null,
                p_payment_splits: paymentSplits || null,
            });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Payment method updated successfully");
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['day-summary'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
        onError: (error: any) => {
            console.error("Failed to update payment method:", error);
            toast.error(error.message || "Failed to update payment method");
        },
    });
};
