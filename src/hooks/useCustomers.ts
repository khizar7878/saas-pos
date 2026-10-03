import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Account, Database } from '@/types/database';
import { toast } from 'sonner';

export interface CustomerWithHistory extends Account {
  bank_names: { name: string } | null;
  sales_count?: number;
  payments_count?: number;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
}

export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_subtype', 'receivable')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as CustomerWithHistory[];
    },
  });
};

export const useCustomer = (id: string | undefined) => {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*, bank_names(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CustomerWithHistory;
    },
  });
};

export const useCustomerCompleteHistory = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ['customer-complete-history', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return { sales: [], returns: [], payments: [], pendingCreditSales: [] };

      // Run all queries in parallel for better performance
      const [salesResult, returnsResult, paymentsResult, creditSalesResult] = await Promise.all([
        // Get all sales
        supabase
          .from('sales')
          .select('*, sale_items(product_name, quantity, unit_price, total_price)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),

        // Get all returns
        supabase
          .from('returns')
          .select('*, return_items(product_name, quantity, unit_price, total_price)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),

        // Get all payments (from customer)
        supabase
          .from('payments')
          .select(`
            *,
            to_account:accounts!to_account_id(id, name)
          `)
          .eq('from_account_id', customerId)
          .eq('from_account_id', customerId)
          .order('created_at', { ascending: false }),

        // Get pending credit sales
        supabase
          .from('credit_sales')
          .select('*')
          .eq('customer_id', customerId)
          // .eq('status', 'pending') // Fetch all to track payments
          .order('created_at', { ascending: false })
      ]);

      if (salesResult.error) throw salesResult.error;
      if (returnsResult.error) throw returnsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (creditSalesResult.error) throw creditSalesResult.error;

      return {
        sales: salesResult.data || [],
        returns: returnsResult.data || [],
        payments: paymentsResult.data || [],
        pendingCreditSales: creditSalesResult.data || []
      };
    },
  });
};

export const useCustomerHistory = (customerId: string | null) => {
  return useQuery({
    queryKey: ['customer-history', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return { sales: [], payments: [] };

      // Get sales for this customer
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Get pending/delivered credit sales for this customer (completed credit sales are already recorded in sales)
      const { data: creditSales, error: creditSalesError } = await supabase
        .from('credit_sales')
        .select('*')
        .eq('customer_id', customerId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (creditSalesError) throw creditSalesError;

      const combinedSales = [
        ...(sales || []),
        ...(creditSales || []).map(cs => ({
          id: cs.id,
          sale_number: cs.bill_number,
          payment_method: `Credit (${cs.status})`,
          total_amount: cs.total_amount,
          created_at: cs.created_at,
          status: cs.status,
          is_credit_bill: true
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get payments received from this customer
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          to_account:accounts!to_account_id(id, name)
        `)
        .eq('from_account_id', customerId)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      return { sales: combinedSales, payments: payments || [] };
    },
  });
};

export const useAddCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<Database['public']['Tables']['accounts']['Insert'], 'account_type' | 'account_subtype'> & { opening_balance?: number }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          ...customer,
          account_type: 'asset',
          account_subtype: 'receivable',
          current_balance: customer.opening_balance || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Customer added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add customer: ' + error.message);
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(customer)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Customer updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update customer: ' + error.message);
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Customer deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete customer: ' + error.message);
    },
  });
};
