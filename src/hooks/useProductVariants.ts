import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductVariant } from '@/types/database';
import { toast } from 'sonner';

export const useProductVariants = (productId?: string) => {
  return useQuery({
    queryKey: ['product_variants', productId],
    enabled: !!productId,
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ProductVariant[];
    },
  });
};

export const useAddProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variantData: {
      product_id: string;
      title?: string;
      size?: string;
      color_name?: string;
      color_hex?: string;
      sku?: string;
      barcode?: string;
      price?: number;
      cost_price?: number;
      stock_quantity?: number;
      is_available?: boolean;
      attributes?: Record<string, any>;
    }) => {
      const payload = {
        ...variantData,
        title: variantData.title || [variantData.size, variantData.color_name].filter(Boolean).join(' / ') || 'Standard Variant',
        is_available: variantData.is_available ?? true,
        stock_quantity: variantData.stock_quantity ?? 0,
      };

      const { data, error } = await supabase
        .from('product_variants')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Ensure parent product has_variants = true
      await supabase
        .from('products')
        .update({ has_variants: true })
        .eq('id', variantData.product_id);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product_variants', variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Variant created successfully');
    },
    onError: (error: any) => {
      console.error('Error adding variant:', error);
      toast.error('Failed to add variant: ' + error.message);
    },
  });
};

export const useBatchCreateVariants = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variants,
    }: {
      productId: string;
      variants: Array<{
        title: string;
        size?: string;
        color_name?: string;
        color_hex?: string;
        sku?: string;
        barcode?: string;
        price?: number;
        cost_price?: number;
        stock_quantity?: number;
        attributes?: Record<string, any>;
      }>;
    }) => {
      if (variants.length === 0) return [];

      const rows = variants.map((v) => ({
        product_id: productId,
        title: v.title,
        size: v.size || null,
        color_name: v.color_name || null,
        color_hex: v.color_hex || null,
        sku: v.sku || null,
        barcode: v.barcode || null,
        price: v.price ?? null,
        cost_price: v.cost_price ?? null,
        stock_quantity: v.stock_quantity ?? 0,
        attributes: v.attributes ?? {},
        is_available: true,
      }));

      const { data, error } = await supabase
        .from('product_variants')
        .insert(rows)
        .select();

      if (error) throw error;

      await supabase
        .from('products')
        .update({ has_variants: true })
        .eq('id', productId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product_variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Generated ${variables.variants.length} variants!`);
    },
    onError: (error: any) => {
      console.error('Error batch adding variants:', error);
      toast.error('Failed to generate variants: ' + error.message);
    },
  });
};

export const useUpdateProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      productId,
      ...updates
    }: Partial<ProductVariant> & { id: string; productId: string }) => {
      const { data, error } = await supabase
        .from('product_variants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product_variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Variant updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating variant:', error);
      toast.error('Failed to update variant: ' + error.message);
    },
  });
};

export const useDeleteProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Check remaining variants
      const { count } = await supabase
        .from('product_variants')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

      if (!count || count === 0) {
        await supabase
          .from('products')
          .update({ has_variants: false })
          .eq('id', productId);
      }

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product_variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Variant removed');
    },
    onError: (error: any) => {
      console.error('Error deleting variant:', error);
      toast.error('Failed to remove variant: ' + error.message);
    },
  });
};
