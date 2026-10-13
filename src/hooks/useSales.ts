import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale, SaleItem, PaymentMethod, SaleStatus } from '@/types/database';
import { toast } from "sonner";
import QRCode from 'qrcode';

import { buildFBRInvoicePayload, submitToFBR } from '@/services/fbrService';

export interface SaleInsertData {
  customer_id?: string | null;
  customer_name: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  amount_received: number;
  change_amount: number;
  deposit_account_id?: string | null;
  notes?: string | null;
  cheque_number?: string | null;
  cheque_bank?: string | null;
  cheque_date?: string | null;
  sale_type?: 'counter' | 'delivery';
  payment_splits?: any[];
  received_by?: string | null;
}

export interface SaleItemInsertData {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_percentage?: number;
  tax_amount?: number;
  discount?: number;
  pct_code?: string;
}

export interface CreateSaleData {
  sale: SaleInsertData;
  items: SaleItemInsertData[];
}

export const useSalesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = `sales_realtime_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          console.log('[Realtime] Sales changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['sales'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'returns',
        },
        (payload) => {
          console.log('[Realtime] Returns changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['returns'] });
          queryClient.invalidateQueries({ queryKey: ['sales'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

export const useSales = () => {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          payment_details,
          customer:accounts!customer_id(id, name, phone, current_balance)
        `)
        .order('created_at', { ascending: false })
        .limit(50000);

      if (error) throw error;
      return data as (Sale & { customer: { id: string; name: string; phone?: string; current_balance?: number } | null })[];
    },
  });
};

export const useTodaySales = () => {
  return useQuery({
    queryKey: ['sales', 'today', 'counter'], // Updated to include counter filter
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          payment_details,
          customer:accounts!customer_id(id, name, phone, current_balance)
        `)
        .gte('created_at', today.toISOString())
        .eq('sale_type', 'counter')
        .order('created_at', { ascending: false })
        .limit(50000);

      if (error) throw error;
      return data as (Sale & { customer: { id: string; name: string; phone?: string; current_balance?: number } | null })[];
    },
  });
};

export const useSalesByDateRange = (from: Date | undefined, to: Date | undefined, saleType?: 'counter' | 'delivery') => {
  return useQuery({
    queryKey: ['sales', 'date-range', from?.toISOString(), to?.toISOString(), saleType],
    enabled: !!from,
    queryFn: async () => {
      if (!from) return [];

      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = to || from;
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);

      let query = supabase
        .from('sales')
        .select(`
          *,
          payment_details,
          sale_items (quantity, product_name),
          customer:accounts!customer_id(id, name, phone, current_balance)
        `)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDateEnd.toISOString());

      if (saleType) {
        query = query.eq('sale_type', saleType);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50000);

      if (error) throw error;
      return data as (Sale & { customer: { id: string; name: string; phone?: string; current_balance?: number } | null })[];
    },
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sale, items }: CreateSaleData) => {
      // 1. Prepare Data for RPC
      const saleData = {
        ...sale,
      };

      // 2. Call the RPC function to create sale
      const { data: createdSale, error } = await supabase
        .rpc('process_sale_transaction', {
          sale_data: saleData,
          items_data: items
        });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      // 3. FBR Integration
      let fbrInvoiceNumber = null;
      let fbrQrCode = null;

      if (sale.payment_method !== 'credit') {
        try {
          // Fetch Store Settings & Store Module Licensing
          const [settingsRes, storeRes] = await Promise.all([
            supabase
              .from('store_settings')
              .select('fbr_integration_enabled, fbr_pos_id, fbr_api_url')
              .single(),
            supabase
              .from('stores')
              .select('enabled_modules')
              .single()
          ]);

          const settings = settingsRes.data;
          const store = storeRes.data;
          const isFbrLicensed = store?.enabled_modules?.fbr_integration !== false;

          // Only engage FBR if store is licensed AND operational toggle is active
          if (isFbrLicensed && settings?.fbr_integration_enabled) {
            const payload = await buildFBRInvoicePayload({
              cart: items.map(item => ({
                product_id: item.product_id,
                name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                tax_percentage: item.tax_percentage || 0,
                tax_amount: item.tax_amount || 0,
                discount: item.discount || 0,
                pct_code: item.pct_code
              })),
              posId: parseInt(settings.fbr_pos_id || "189142"),
              usin: createdSale.sale_number, // Use the generated sale number
              paymentMethod: sale.payment_method === 'cash' ? 1 : 2, // Simple mapping for now
              invoiceDate: new Date().toISOString(),
              discountAmount: sale.discount_amount,
              customerName: sale.customer_name
            });

            console.log("Sending to FBR:", payload);

            const fbrResponse = await submitToFBR(settings.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice", payload);

            console.log("FBR Response Received:", fbrResponse);

            // Handle case sensitivity (Backend returns PascalCase usually)
            const rawInvoiceNo = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;

            if (rawInvoiceNo) {
              // The response from .NET backend might be a JSON string inside FBRInvoiceNumber or direct field
              let actualInvoiceNo = rawInvoiceNo;

              // Try to parse if it looks like JSON
              if (actualInvoiceNo && typeof actualInvoiceNo === 'string' && actualInvoiceNo.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(actualInvoiceNo);
                  actualInvoiceNo = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || actualInvoiceNo;
                } catch (e) {
                  console.warn("Failed to parse inner JSON of FBR Invoice Number", e);
                }
              }


              fbrInvoiceNumber = actualInvoiceNo;

              // Generate a simple QR Code containing ONLY the FBR Invoice Number
              try {
                fbrQrCode = await QRCode.toDataURL(fbrInvoiceNumber);
              } catch (qrErr) {
                console.error("Failed to generate simple QR code", qrErr);
                fbrQrCode = ""; // Fallback
              }

              console.log("Parsed FBR Invoice #:", fbrInvoiceNumber);

              // Update Sale Record
              await supabase
                .from('sales')
                .update({
                  fbr_invoice_number: fbrInvoiceNumber,
                  fbr_qr_code: fbrQrCode
                })
                .eq('id', createdSale.id);
            } else {
              console.warn("FBR Response did not contain an Invoice Number", fbrResponse);
              toast.error("FBR did not return an invoice number.");
            }
          }
        } catch (fbrError) {
          console.error("FBR Integration Failed:", fbrError);
          toast.error("Sale saved, but FBR submission failed.");
          // We do NOT throw here, we let the sale complete
        }
      }

      // Return combined data
      return {
        ...createdSale,
        fbr_invoice_number: fbrInvoiceNumber,
        fbr_qr_code: fbrQrCode
      };
    },
    onSuccess: (_, variables) => {
      // Invalidate all relevant queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['credit_sales'] });
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      queryClient.invalidateQueries({ queryKey: ['customer-complete-history'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-history'] });

      if (variables.sale.payment_method === 'credit') {
        toast.success('Credit Sale (Pending Payment) recorded');
      } else {
        toast.success('Sale completed successfully');
      }

      // Sync to AKWS if deposit account is linked
      if (variables.sale.deposit_account_id) {
        const syncToAkws = async () => {
          try {
            // 1. Get Local Account to check for link
            const { data: localAccount } = await supabase
              .from('accounts')
              .select('akws_account_id, name')
              .eq('id', variables.sale.deposit_account_id!)
              .single();

            if (localAccount?.akws_account_id) {
              // Dynamically import to avoid circular dependencies or initialization issues if unused
              const { akwsSupabase } = await import('@/lib/akwsSupabase');

              // 2. Fetch Remote Account
              const { data: remoteAccount, error: remoteFetchError } = await akwsSupabase
                .from('accounts')
                .select('current_balance')
                .eq('id', localAccount.akws_account_id)
                .single();

              if (remoteFetchError) {
                console.error("AKWS Fetch Error:", remoteFetchError);
                return;
              }

              if (remoteAccount) {
                const amount = variables.sale.amount_received;
                const newBalance = remoteAccount.current_balance + amount;

                // 3. Update Balance
                const { error: updateError } = await akwsSupabase
                  .from('accounts')
                  .update({ current_balance: newBalance })
                  .eq('id', localAccount.akws_account_id);

                if (updateError) throw updateError;

                // 4. Insert Ledger Entry
                const { error: ledgerError } = await akwsSupabase
                  .from('ledger_entries')
                  .insert({
                    account_id: localAccount.akws_account_id,
                    description: `Retail POS Sale: ${variables.sale.customer_name || 'Walk-in'}`,
                    debit: amount,
                    credit: 0,
                    balance: newBalance,
                    reference_type: 'sale', // Use standard type
                    created_at: new Date().toISOString()
                  });

                if (ledgerError) throw ledgerError;

                toast.success(`Synced transaction to AKWS: ${localAccount.name}`);
              }
            }
          } catch (err) {
            console.error("AKWS Sync Failed:", err);
            toast.error("Sales saved locally, but failed to sync to AKWS");
          }
        };

        syncToAkws();
      }
    },
    onError: (error) => {
      const err = error as any;
      // Extract detailed error if available
      const msg = err?.message || err?.details || 'Unknown error occurred';
      toast.error('Failed to process sale: ' + msg);
      console.error('useCreateSale failed', err);
    },
  });
};

export const useCompleteCreditSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creditSaleId, paymentDetails }: { creditSaleId: string, paymentDetails: any }) => {
      console.log("Completing credit sale via RPC...", { creditSaleId, paymentDetails });

      // 1. Call RPC
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('process_credit_sale_completion', {
          p_credit_sale_id: creditSaleId,
          p_payment_method: paymentDetails.payment_method,
          p_amount_received: paymentDetails.amount_received,
          p_change_amount: paymentDetails.change_amount
        });

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw rpcError;
      }

      console.log("RPC Success:", rpcResult);

      // 2. FBR Integration (Client-side trigger after successful DB transaction)
      let fbrInvoiceNumber = null;
      let fbrQrCode = null;

      try {
        // Fetch Settings & Store Licensing explicitly
        const [settingsRes, storeRes] = await Promise.all([
          supabase
            .from('store_settings')
            .select('fbr_integration_enabled, fbr_pos_id, fbr_api_url')
            .single(),
          supabase
            .from('stores')
            .select('enabled_modules')
            .single()
        ]);

        const settings = settingsRes.data;
        const store = storeRes.data;
        const isFbrLicensed = store?.enabled_modules?.fbr_integration !== false;

        if (isFbrLicensed && settings?.fbr_integration_enabled) {
          const items = rpcResult.items || [];

          // Sanitize items: filter items with remaining quantity > 0 and calculate net values
          const validItems = items
            .map((item: any) => {
              const returned = Number(item.quantity_returned ?? item.returned ?? 0);
              const qty = Math.max(0, Number(item.quantity || 0) - returned);
              const unitPrice = Number(item.unit_price || item.price || 0);
              const totalPrice = Number(returned > 0 ? qty * unitPrice : (item.total_price || qty * unitPrice));
              const taxPct = Number(item.tax_percentage || item.tax_percent || 0);
              const taxAmt = taxPct > 0 ? (totalPrice - (totalPrice / (1 + taxPct / 100))) : 0;

              return {
                product_id: item.product_id,
                name: item.product_name || item.name || 'Item',
                quantity: qty,
                unit_price: unitPrice,
                total_price: totalPrice,
                tax_percentage: taxPct,
                tax_amount: Number(taxAmt.toFixed(2)),
                discount: Number(item.discount || 0),
                pct_code: item.pct_code || '01011000'
              };
            })
            .filter((item: any) => item.quantity > 0);

          if (validItems.length === 0) {
            console.warn("No remaining items to submit to FBR for credit sale", rpcResult.sale_number);
          } else {
            const payload = await buildFBRInvoicePayload({
              cart: validItems,
              posId: parseInt(settings.fbr_pos_id || "189142"),
              usin: rpcResult.sale_number,
              paymentMethod: paymentDetails.payment_method === 'cash' ? 1 : 2,
              invoiceDate: new Date().toISOString(),
              discountAmount: 0,
              customerName: rpcResult.customer_name
            });

            console.log("Sending Credit Sale to FBR:", payload);
            const fbrResponse = await submitToFBR(settings.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice", payload);
            console.log("FBR Response:", fbrResponse);

            const rawInvoiceNo = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;
            if (rawInvoiceNo) {
              let actualInvoiceNo = rawInvoiceNo;
              if (actualInvoiceNo && typeof actualInvoiceNo === 'string' && actualInvoiceNo.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(actualInvoiceNo);
                  actualInvoiceNo = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || actualInvoiceNo;
                } catch (e) {
                  console.warn("Failed to parse inner JSON of FBR Invoice Number", e);
                }
              }

              fbrInvoiceNumber = actualInvoiceNo;

              try {
                fbrQrCode = await QRCode.toDataURL(fbrInvoiceNumber);
              } catch (qrErr) {
                console.error("Failed to generate simple QR code", qrErr);
              }

              // Update Sale with FBR info
              await supabase
                .from('sales')
                .update({
                  fbr_invoice_number: fbrInvoiceNumber,
                  fbr_qr_code: fbrQrCode
                })
                .eq('id', rpcResult.sale_id);
            } else {
              toast.error("FBR did not return an invoice number.");
            }
          }
        } else {
          console.log("FBR Integration is DISABLED in settings.");
        }
      } catch (fbrError) {
        console.error("FBR Integration Failed for Credit Sale:", fbrError);
        toast.error("Payment received, but FBR submission failed.");
      }

      return {
        id: rpcResult.sale_id,
        sale_number: rpcResult.sale_number,
        fbr_invoice_number: fbrInvoiceNumber,
        fbr_qr_code: fbrQrCode
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['credit_sales'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['customer-complete-history'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-history'] });
      toast.success('Payment Received & Bill Completed');
    },
    onError: (error) => {
      console.error("Complete Credit Sale Error:", error);
      toast.error('Failed to receive payment: ' + (error as Error).message);
    }
  });

};

export const useDeliverCreditBill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creditSaleId: string) => {
      const { error } = await supabase
        .from('credit_sales')
        .update({ status: 'delivered' })
        .eq('id', creditSaleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_sales'] });
      toast.success('Bill marked as Delivered');
    },
    onError: (error) => {
      toast.error('Failed to deliver bill: ' + (error as Error).message);
    }
  });
};

export const useSaleWithItems = (saleId: string | null) => {
  return useQuery({
    queryKey: ['sale', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      if (!saleId) return null;

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:accounts!customer_id(id, name, phone, current_balance)
        `)
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      return { sale, items };
    },
  });
};

export const useCancelSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`*, sale_items(*)`)
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;
      if (sale.status === 'cancelled') throw new Error('Sale is already cancelled');

      // Reverse Inventory
      for (const item of sale.sale_items) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('id, stock_quantity')
            .eq('id', item.product_id)
            .maybeSingle();

          if (product) {
            const qtyToRestore = (item.quantity && item.quantity > 0) ? item.quantity : 1;
            await supabase
              .from('products')
              .update({ stock_quantity: product.stock_quantity + qtyToRestore })
              .eq('id', product.id);
          }
        }
      }

      // Reverse Financials
      const { data: originalEntries } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('reference_type', 'sale')
        .eq('reference_id', saleId);

      if (originalEntries) {
        for (const entry of originalEntries) {
          if (entry.debit > 0) {
            const { data: account } = await supabase.from('accounts').select('current_balance').eq('id', entry.account_id).single();

            if (account) {
              const newBalance = account.current_balance - entry.debit;
              await supabase.from('accounts').update({ current_balance: newBalance }).eq('id', entry.account_id);

              await supabase.from('ledger_entries').insert({
                account_id: entry.account_id,
                reference_type: 'sale_cancellation',
                reference_id: saleId,
                description: `Reversal: ${entry.description}`,
                debit: 0,
                credit: entry.debit,
                balance: newBalance
              });
            }
          }
        }
      }

      const { data: cheques } = await supabase.from('cheques').select('id').eq('source_sale_id', saleId);
      if (cheques && cheques.length > 0) {
        await supabase.from('cheques').update({ status: 'cancelled' }).in('id', cheques.map(c => c.id));
      }

      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast.success('Sale cancelled successfully');
    },
    onError: (error) => {
      toast.error('Failed to cancel sale: ' + error.message);
    }
  });
};

export const useUpdateSaleType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ saleId, newType }: { saleId: string, newType: 'counter' | 'delivery' }) => {
      const { error } = await supabase
        .from('sales')
        .update({ sale_type: newType })
        .eq('id', saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Sale type updated');
    },
    onError: (error) => {
      toast.error('Failed to update sale type: ' + (error as Error).message);
    }
  });
};
