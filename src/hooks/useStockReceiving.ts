import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { warehouseSupabase } from '@/lib/warehouseSupabase';
import { toast } from 'sonner';

interface ReceivingItem {
  productId: string;
  variationId?: string | null;
  quantity: number; // Suits/Pieces
  metersPerPiece: number;
  orderItemId?: string;
}

// Hook to query all active in-transit vouchers (status = 'transferred')
export const useInTransitVouchers = (customerLocationId?: string) => {
  return useQuery({
    queryKey: ['in_transit_vouchers', customerLocationId],
    queryFn: async () => {
      if (!customerLocationId) return [];
      const db = warehouseSupabase || supabase;
      const { data, error } = await db
        .from('dispatch_vouchers')
        .select(`
          *,
          customer:accounts!dispatch_vouchers_customer_id_fkey (name, phone),
          items:dispatch_items (
            id,
            order_item:warehouse_order_items (
              id,
              base_product_id,
              quantity_meters,
              rolls_count,
              processed_lot_id,
              selected_grade,
              processed_lot:product_lots (lot_number),
              base_product:warehouse_products (id, name, sku)
            )
          )
        `)
        .eq('status', 'transferred')
        .eq('customer_id', customerLocationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerLocationId,
  });
};

// Hook to query a single in-transit voucher by ID
export const useInTransitVoucher = (id: string | null) => {
  return useQuery({
    queryKey: ['in_transit_voucher', id],
    queryFn: async () => {
      if (!id) return null;
      const db = warehouseSupabase || supabase;
      const { data, error } = await db
        .from('dispatch_vouchers')
        .select(`
          *,
          customer:accounts!dispatch_vouchers_customer_id_fkey (name, phone),
          items:dispatch_items (
            id,
            order_item:warehouse_order_items (
              id,
              base_product_id,
              quantity_meters,
              rolls_count,
              processed_lot_id,
              selected_grade,
              processed_lot:product_lots (lot_number),
              base_product:warehouse_products (id, name, sku)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useReceiveStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      items, 
      notes,
      voucherId
    }: { 
      items: ReceivingItem[]; 
      notes?: string;
      voucherId?: string;
    }) => {
      if (voucherId) {
        const db = warehouseSupabase || supabase;
        const { data: userData } = await db.auth.getUser();
        
        const formattedItems = items.map(item => {
          if (!item.orderItemId) {
            throw new Error('Missing Order Item reference for voucher item.');
          }
          return {
            order_item_id: item.orderItemId,
            variation_id: item.variationId || null,
            rolls_received: item.quantity,
            meters_received: item.quantity * item.metersPerPiece,
          };
        });

        const { data: receiptId, error: rpcError } = await db.rpc('receive_dispatch_voucher', {
          p_voucher_id: voucherId,
          p_notes: notes || '',
          p_received_by: userData?.user?.id || null,
          p_received_items: formattedItems
        });

        if (rpcError) throw rpcError;
        return { id: receiptId, isVoucher: true };
      }

      // Manual Stock Receiving operates on local POS supabase
      const { data: receiptNumber, error: seqError } = await supabase
        .rpc('get_next_sequence', { seq_id: 'stock_receipt' });

      if (seqError) {
        // Fallback sequence if RPC is missing locally
        const fallbackSeq = `SR-${Date.now().toString().slice(-6)}`;
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalMeters = items.reduce((sum, item) => sum + (item.quantity * item.metersPerPiece), 0);

        const { data: receipt, error: receiptError } = await supabase
          .from('stock_receipts')
          .insert({
            receipt_number: fallbackSeq,
            total_rolls: totalQuantity,
            total_meters: totalMeters,
            notes: notes || null,
          })
          .select()
          .single();

        if (receiptError) throw receiptError;

        const receiptItems = items.map(item => ({
          receipt_id: receipt.id,
          product_id: item.productId,
          rolls_received: item.quantity,
          meters_per_roll: item.metersPerPiece,
          total_meters: item.quantity * item.metersPerPiece,
        }));

        const { error: itemsError } = await supabase
          .from('stock_receipt_items')
          .insert(receiptItems);

        if (itemsError) throw itemsError;

        for (const item of items) {
          const { data: product, error: prodError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.productId)
            .single();

          if (!prodError && product) {
            const newQty = product.stock_quantity + item.quantity;
            await supabase
              .from('products')
              .update({ stock_quantity: newQty })
              .eq('id', item.productId);
          }
        }

        return { ...receipt, isVoucher: false };
      }

      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalMeters = items.reduce((sum, item) => sum + (item.quantity * item.metersPerPiece), 0);

      // Create local stock receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('stock_receipts')
        .insert({
          receipt_number: receiptNumber,
          total_rolls: totalQuantity,
          total_meters: totalMeters,
          notes: notes || null,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create local receipt items
      const receiptItems = items.map(item => ({
        receipt_id: receipt.id,
        product_id: item.productId,
        rolls_received: item.quantity,
        meters_per_roll: item.metersPerPiece,
        total_meters: item.quantity * item.metersPerPiece,
      }));

      const { error: itemsError } = await supabase
        .from('stock_receipt_items')
        .insert(receiptItems);

      if (itemsError) throw itemsError;

      // Update local product stock
      for (const item of items) {
        const { data: product, error: prodError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.productId)
          .single();

        if (!prodError && product) {
          const newQty = product.stock_quantity + item.quantity;
          await supabase
            .from('products')
            .update({ stock_quantity: newQty })
            .eq('id', item.productId);
        }
      }

      return { ...receipt, isVoucher: false };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_receipts'] });
      queryClient.invalidateQueries({ queryKey: ['in_transit_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['in_transit_voucher'] });

      if (data?.isVoucher) {
        toast.success('Stock received and matched with dispatch voucher!');
      } else {
        toast.success(`Stock received! Receipt #${data.receipt_number}`);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to receive stock: ' + error.message);
    },
  });
};

export const useMarkVoucherReceived = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voucherId,
      notes
    }: {
      voucherId: string;
      notes?: string;
    }) => {
      const db = warehouseSupabase || supabase;
      const { data: userData } = await db.auth.getUser();

      const { data: voucherData, error: fetchError } = await db
        .from('dispatch_vouchers')
        .select(`
          id,
          voucher_number,
          items:dispatch_items (
            id,
            order_item_id
          )
        `)
        .eq('id', voucherId)
        .single();

      if (fetchError) throw fetchError;

      const formattedItems = (voucherData?.items || []).map((item: any) => ({
        order_item_id: item.order_item_id,
        variation_id: null,
        rolls_received: 1,
        meters_received: 0
      }));

      // Try RPC first
      const { error: rpcError } = await db.rpc('receive_dispatch_voucher', {
        p_voucher_id: voucherId,
        p_notes: notes || 'Marked as received from Dispatched Orders',
        p_received_by: userData?.user?.id || null,
        p_received_items: formattedItems
      });

      // Fallback: direct update status to 'received' if RPC fails
      if (rpcError) {
        const { error: updateError } = await db
          .from('dispatch_vouchers')
          .update({ status: 'received', updated_at: new Date().toISOString() })
          .eq('id', voucherId);

        if (updateError) throw updateError;
      }

      return voucherData;
    },
    onSuccess: (voucher: any) => {
      queryClient.invalidateQueries({ queryKey: ['in_transit_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['in_transit_voucher'] });
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      toast.success(`Voucher #${voucher.voucher_number} marked as received!`);
    },
    onError: (error: any) => {
      toast.error('Failed to mark voucher as received: ' + error.message);
    }
  });
};

export const useReceivedStockByDateRange = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['stock_receipts_report', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      
      const startStr = startDate.toISOString();
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      const endStr = endOfDay.toISOString();

      const { data, error } = await supabase
        .from('stock_receipts')
        .select(`
          *,
          stock_receipt_items (
            *,
            product:products(name)
          )
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });
};
