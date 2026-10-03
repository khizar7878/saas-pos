import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { warehouseSupabase } from '@/lib/warehouseSupabase';
import { toast } from 'sonner';

export interface WarehouseProduct {
  id: string;
  name: string;
  sku: string;
  is_active: boolean;
}

export interface WarehouseProductVariation {
  id: string;
  product_id: string;
  sku: string;
  meters_per_unit: number;
  is_active: boolean;
}

export interface WarehouseOrder {
  id: string;
  order_number: string;
  customer_id: string;
  source_location_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  created_at: string;
  customer?: {
    name: string;
    phone: string | null;
    city?: string | null;
  };
  source_location?: {
    name: string;
  };
  items?: WarehouseOrderItem[];
}

export interface WarehouseOrderItem {
  id: string;
  order_id: string;
  custom_product_id: string | null;
  base_product_id: string | null;
  quantity_meters: number;
  rolls_count: number;
  packing_details: string | null;
  status: 'pending' | 'processed' | 'packed' | 'dispatched';
  processed_lot_id: string | null;
  selected_grade: 'A' | 'B' | 'fresh_cut' | 'cut_piece' | 'mill_cut_piece' | 'unsettled' | 'rags';
  processed_at: string | null;
  packed_location_id: string | null;
  base_product?: {
    name: string;
    sku: string;
  };
  processed_lot?: {
    lot_number: string;
    hall_number: string | null;
    wall_number: string | null;
  };
  packed_location?: {
    name: string;
  } | null;
  orderNumber?: string;
  customerName?: string;
  orderDate?: string;
}

// Helper to get candidate customer IDs specifically for Retail Shop # 1
async function getShopCandidateIds(db: any, shopLocationId?: string | null): Promise<string[]> {
  const idsSet = new Set<string>();
  if (shopLocationId) idsSet.add(shopLocationId);

  try {
    const { data: matchedAccounts } = await db
      .from('accounts')
      .select('id')
      .or('name.ilike.%Retail Shop # 1%,name.ilike.%Retail Shop 1%');

    if (matchedAccounts && matchedAccounts.length > 0) {
      matchedAccounts.forEach((a: any) => idsSet.add(a.id));
    }
  } catch (err) {
    console.error('Failed to query candidate account IDs for Retail Shop # 1:', err);
  }

  return Array.from(idsSet).filter(Boolean);
}

// Hook to query base products from warehouse_products
export const useWarehouseProducts = () => {
  return useQuery({
    queryKey: ['warehouse_products'],
    queryFn: async () => {
      const db = warehouseSupabase || supabase;
      const { data, error } = await db
        .from('warehouse_products')
        .select('*, product_categories(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as (WarehouseProduct & { product_categories: { name: string } | null })[];
    },
  });
};

// Hook to query variations from warehouse_product_variations for a base product
export const useWarehouseProductVariations = (productId: string | null) => {
  return useQuery({
    queryKey: ['warehouse_product_variations', productId],
    enabled: !!productId,
    queryFn: async () => {
      if (!productId) return [];

      const db = warehouseSupabase || supabase;
      const { data, error } = await db
        .from('warehouse_product_variations')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('meters_per_unit');

      if (error) throw error;
      return data as WarehouseProductVariation[];
    },
  });
};

// Hook to query shop's warehouse orders
export const useShopWarehouseOrders = (shopLocationId?: string | null, status?: string) => {
  return useQuery({
    queryKey: ['shop_warehouse_orders', shopLocationId, status],
    enabled: !!shopLocationId,
    queryFn: async () => {
      if (!shopLocationId) return [];

      const db = warehouseSupabase || supabase;
      const candidateIds = await getShopCandidateIds(db, shopLocationId);

      let query = db
        .from('warehouse_orders')
        .select(`
          *,
          customer:accounts!warehouse_orders_customer_id_fkey (name, phone, city),
          source_location:locations!warehouse_orders_source_location_id_fkey (name),
          items:warehouse_order_items (
            *,
            base_product:warehouse_products (name, sku),
            processed_lot:product_lots (lot_number, hall_number, wall_number),
            packed_location:locations!warehouse_order_items_packed_location_id_fkey (name)
          )
        `)
        .in('customer_id', candidateIds);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as WarehouseOrder[];
    },
  });
};

// Hook to query packed items for this shop
export const useShopPackedOrderItems = (shopLocationId?: string | null) => {
  return useQuery({
    queryKey: ['shop_packed_order_items', shopLocationId],
    enabled: !!shopLocationId,
    queryFn: async () => {
      if (!shopLocationId) return [];

      const db = warehouseSupabase || supabase;
      const candidateIds = await getShopCandidateIds(db, shopLocationId);

      const { data, error } = await db
        .from('warehouse_order_items')
        .select(`
          *,
          order:warehouse_orders!inner!warehouse_order_items_order_id_fkey (
            order_number,
            customer_id,
            customer:accounts!warehouse_orders_customer_id_fkey (name, city)
          ),
          base_product:warehouse_products (name, sku),
          processed_lot:product_lots (lot_number, hall_number, wall_number),
          packed_location:locations!warehouse_order_items_packed_location_id_fkey (name)
        `)
        .eq('status', 'packed')
        .in('order.customer_id', candidateIds)
        .order('processed_at', { ascending: false });

      if (error) throw error;
      return data as unknown as any[];
    },
  });
};

// Mutation to book a new B2B Sales Order from the shop
export const useCreateWarehouseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      customer_id: string;
      items: {
        base_product_id: string;
        quantity_meters: number;
        rolls_count: number;
        packing_details?: string;
      }[];
    }) => {
      const db = warehouseSupabase || supabase;

      // 1. Get next order number sequence
      const { data: orderNum, error: seqError } = await db
        .rpc('get_next_sequence', { seq_id: 'warehouse_order' });

      if (seqError) throw seqError;

      // 2. Insert order header
      const { data: orderData, error: orderError } = await db
        .from('warehouse_orders')
        .insert({
          order_number: orderNum,
          customer_id: payload.customer_id,
          source_location_id: null,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Insert order items
      const itemsToInsert = payload.items.map(item => ({
        order_id: orderData.id,
        custom_product_id: null,
        base_product_id: item.base_product_id,
        quantity_meters: item.quantity_meters,
        rolls_count: item.rolls_count,
        packing_details: item.packing_details || null,
        status: 'pending'
      }));

      const { error: itemsError } = await db
        .from('warehouse_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 4. Query shop name and notify warehouse
      try {
        const { data: locData } = await db
          .from('locations')
          .select('name')
          .eq('id', payload.customer_id)
          .single();
        const shopName = locData?.name || 'Retail Shop # 1';

        const productIds = payload.items.map(i => i.base_product_id).filter(Boolean);
        const { data: baseProducts } = await db
          .from('warehouse_products')
          .select('id, name')
          .in('id', productIds);

        const itemsSummary = payload.items.map(item => {
          const bp = baseProducts?.find(p => p.id === item.base_product_id);
          const name = bp?.name || 'Product';
          return `${name.toUpperCase()} ${item.rolls_count} x ${item.quantity_meters}m`;
        }).join('\n');

        await db
          .from('notifications')
          .insert({
            recipient_role: 'warehouse',
            location_id: payload.customer_id,
            title: 'New Order Booked',
            message: `Order #${orderNum}\nBooked by ${shopName}\n${itemsSummary}`,
            type: 'order_created',
            reference_id: orderData.id
          });
      } catch (notifErr) {
        console.error('Failed to trigger order creation notification:', notifErr);
      }

      return orderData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      toast.success('Order booked successfully in the Order Book');
    },
    onError: (error: any) => {
      console.error('Book order error:', error);
      toast.error('Failed to create order: ' + error.message);
    }
  });
};

// Mutation to delete a pending order item
export const useDeleteOrderItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { order_item_id: string }) => {
      const db = warehouseSupabase || supabase;
      const { data: item, error: fetchError } = await db
        .from('warehouse_order_items')
        .select('order_id, status, base_product_id, order:warehouse_orders(order_number, customer_id)')
        .eq('id', payload.order_item_id)
        .single();

      if (fetchError || !item) {
        throw new Error('Order item not found');
      }

      if (item.status !== 'pending') {
        throw new Error('Only pending order items can be removed.');
      }

      const { error: deleteError } = await db
        .from('warehouse_order_items')
        .delete()
        .eq('id', payload.order_item_id);

      if (deleteError) throw deleteError;

      const { data: remaining } = await db
        .from('warehouse_order_items')
        .select('id')
        .eq('order_id', item.order_id);

      if (!remaining || remaining.length === 0) {
        await db
          .from('warehouse_orders')
          .delete()
          .eq('id', item.order_id);
      }

      try {
        const customerId = (item.order as any)?.customer_id;
        const { data: locData } = await db
          .from('locations')
          .select('name')
          .eq('id', customerId)
          .single();
        const shopName = locData?.name || 'Retail Shop # 1';
        const orderNumber = (item.order as any)?.order_number || 'Unknown';

        let productName = 'Product';
        if (item.base_product_id) {
          const { data: bp } = await db
            .from('warehouse_products')
            .select('name')
            .eq('id', item.base_product_id)
            .single();
          productName = bp?.name || 'Base Product';
        }

        await db
          .from('notifications')
          .insert({
            recipient_role: 'warehouse',
            location_id: (item.order as any)?.customer_id || null,
            title: 'Order Item Removed',
            message: `Order #${orderNumber}\nRemoved from ${shopName}\n"${productName}"`,
            type: 'order_edited',
            reference_id: item.order_id
          });
      } catch (notifErr) {
        console.error('Failed to trigger order edit notification:', notifErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      toast.success('Item removed from order successfully.');
    },
    onError: (error: any) => {
      console.error('Delete order item error:', error);
      toast.error('Failed to remove item: ' + error.message);
    }
  });
};

// Mutation to cancel an entire pending order
export const useCancelWarehouseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { order_id: string }) => {
      const db = warehouseSupabase || supabase;
      const { data: orderData } = await db
        .from('warehouse_orders')
        .select('order_number, customer_id')
        .eq('id', payload.order_id)
        .single();

      const { data: items, error: fetchError } = await db
        .from('warehouse_order_items')
        .select('status')
        .eq('order_id', payload.order_id);

      if (fetchError) throw fetchError;

      const nonPending = items?.filter(item => item.status !== 'pending') || [];
      if (nonPending.length > 0) {
        throw new Error('Cannot cancel order because some items have already been processed, packed, or dispatched.');
      }

      const { error: itemsError } = await db
        .from('warehouse_order_items')
        .delete()
        .eq('order_id', payload.order_id);

      if (itemsError) throw itemsError;

      const { error: orderError } = await db
        .from('warehouse_orders')
        .delete()
        .eq('id', payload.order_id);

      if (orderError) throw orderError;

      if (orderData) {
        try {
          const { data: locData } = await db
            .from('locations')
            .select('name')
            .eq('id', orderData.customer_id)
            .single();
          const shopName = locData?.name || 'Retail Shop # 1';

          await db
            .from('notifications')
            .insert({
              recipient_role: 'warehouse',
              location_id: orderData.customer_id,
              title: 'Order Cancelled',
              message: `Order #${orderData.order_number}\nCancelled by ${shopName}`,
              type: 'order_edited',
              reference_id: payload.order_id
            });
        } catch (notifErr) {
          console.error('Failed to trigger order cancellation notification:', notifErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      toast.success('Order cancelled successfully.');
    },
    onError: (error: any) => {
      console.error('Cancel order error:', error);
      toast.error('Failed to cancel order: ' + error.message);
    }
  });
};

// Mutation to update quantity of a pending order item
export const useUpdateOrderItemQuantity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      order_item_id: string;
      rolls_count: number;
      quantity_meters: number;
    }) => {
      const db = warehouseSupabase || supabase;
      const { data: item, error: fetchError } = await db
        .from('warehouse_order_items')
        .select('order_id, status, rolls_count, quantity_meters, base_product:warehouse_products(name), order:warehouse_orders(order_number, customer_id)')
        .eq('id', payload.order_item_id)
        .single();

      if (fetchError || !item) {
        throw new Error('Order item not found');
      }

      if (item.status !== 'pending') {
        throw new Error('Only pending order items can be edited.');
      }

      const { error: updateError } = await db
        .from('warehouse_order_items')
        .update({
          rolls_count: payload.rolls_count,
          quantity_meters: payload.quantity_meters
        })
        .eq('id', payload.order_item_id);

      if (updateError) throw updateError;

      try {
        const customerId = (item.order as any)?.customer_id;
        const { data: locData } = await db
          .from('locations')
          .select('name')
          .eq('id', customerId)
          .single();
        const shopName = locData?.name || 'Retail Shop # 1';
        const orderNumber = (item.order as any)?.order_number || 'Unknown';
        const productName = item.base_product?.name || 'Product';
        const isIncrease = payload.rolls_count > item.rolls_count;

        await db
          .from('notifications')
          .insert({
            recipient_role: 'warehouse',
            location_id: (item.order as any)?.customer_id || null,
            title: 'Order Updated',
            message: `Order #${orderNumber}\nUpdated by ${shopName}\nThe Quantity of ${productName} was ${isIncrease ? 'increased' : 'decreased'} to ${payload.rolls_count} pcs (${payload.quantity_meters}m).`,
            type: 'order_edited',
            reference_id: item.order_id
          });
      } catch (notifErr) {
        console.error('Failed to trigger order edit notification:', notifErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      toast.success('Order item quantity updated successfully.');
    },
    onError: (error: any) => {
      console.error('Update order item quantity error:', error);
      toast.error('Failed to update quantity: ' + error.message);
    }
  });
};
