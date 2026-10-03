import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Get all accounts
export const useAccounts = () => {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};

export const useAccount = (id: string | null) => {
  return useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          bank_names (
            name
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

// Get cash accounts only
export const useCashAccounts = () => {
  return useQuery({
    queryKey: ['accounts', 'cash'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_type', 'cash')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};

// Get account transactions for a specific account
export const useAccountTransactions = (accountId: string | null) => {
  return useQuery({
    queryKey: ['account_transactions', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('account_transactions')
        .select(`
          *,
          from_account:from_account_id(name),
          to_account:to_account_id(name)
        `)
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
};

// Get ledger entries for a specific account
export const useLedgerEntries = (accountId: string | null) => {
  return useQuery({
    queryKey: ['ledger_entries', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
};

// Add account transaction (transfer)
export const useAddAccountTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: {
      from_account_id?: string;
      to_account_id?: string;
      amount: number;
      transaction_type: string;
      reference_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_transactions'] });
      toast.success('Transaction completed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Transaction failed: ${error.message}`);
    },
  });
};

// Add account (for expenses page)
export const useAddAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (account: {
      name: string;
      account_type: string;
      current_balance?: number;
    }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert([account])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create account: ${error.message}`);
    },
  });
};

// Get bank accounts (placeholder for future sync)
// Get bank accounts
export const useBankAccounts = () => {
  return useQuery({
    queryKey: ['accounts', 'bank'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          bank_names (
            name
          )
        `)
        .or('account_type.eq.bank,account_subtype.eq.bank_account') // Match both old and new (synced) types
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
};

// Get bank names
export const useBankNames = () => {
  return useQuery({
    queryKey: ['bank_names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_names')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
};
