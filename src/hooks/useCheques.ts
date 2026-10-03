import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Cheque {
  id: string;
  cheque_number: string;
  bank_name_id: string | null;
  bank_name: string;
  amount: number;
  cheque_date: string;
  status: 'available' | 'deposited' | 'cleared' | 'bounced' | 'cancelled';
  received_from_account_id: string | null;
  received_via: string | null;
  source_sale_id: string | null;
  source_payment_id: string | null;
  used_for_payment_id: string | null;
  used_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChequeInsert {
  cheque_number: string;
  bank_name_id?: string | null;
  bank_name: string;
  amount: number;
  cheque_date: string;
  status?: 'available' | 'deposited' | 'cleared' | 'bounced' | 'cancelled';
  received_from_account_id?: string | null;
  received_via?: string | null;
  source_sale_id?: string | null;
  source_payment_id?: string | null;
  notes?: string | null;
}

// Fetch all cheques
export const useCheques = (status?: Cheque['status'] | Cheque['status'][]) => {
  return useQuery({
    queryKey: ['cheques', status],
    queryFn: async () => {
      let query = supabase
        .from('cheques')
        .select('*')
        .order('cheque_date', { ascending: false });

      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status);
        } else {
          query = query.eq('status', status);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Cheque[];
    },
  });
};

// Fetch only available cheques (for selection when making payments)
export const useAvailableCheques = () => useCheques('available');

// Get cheques grouped by bank name
export const useChequesGroupedByBank = () => {
  const { data: cheques = [], ...rest } = useAvailableCheques();

  const groupedByBank = cheques.reduce((acc, cheque) => {
    const bankName = cheque.bank_name;
    if (!acc[bankName]) {
      acc[bankName] = [];
    }
    acc[bankName].push(cheque);
    return acc;
  }, {} as Record<string, Cheque[]>);

  const bankNames = Object.keys(groupedByBank).sort();

  return {
    ...rest,
    data: cheques,
    groupedByBank,
    bankNames,
  };
};

// Add a new cheque (when receiving payment via cheque)
export const useAddCheque = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cheque: ChequeInsert) => {
      const { data, error } = await supabase
        .from('cheques')
        .insert(cheque)
        .select()
        .single();

      if (error) throw error;
      return data as Cheque;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
    },
    onError: (error) => {
      toast.error('Failed to record cheque: ' + error.message);
    },
  });
};

// Mark cheques as used (when making a payment with cheques)
export const useUseCheques = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chequeIds, paymentId }: { chequeIds: string[]; paymentId: string }) => {
      const { error } = await supabase
        .from('cheques')
        .update({
          status: 'deposited',
          used_for_payment_id: paymentId,
          used_at: new Date().toISOString(),
        })
        .in('id', chequeIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error) => {
      toast.error('Failed to process cheques: ' + error.message);
    },
  });
};

// Update cheque status (for clearing, bouncing, etc.) - DEPRECATED: Cheques are now treated as liquid cash
export const useUpdateChequeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chequeId, status }: { chequeId: string; status: Cheque['status'] }) => {
      const { error } = await supabase
        .from('cheques')
        .update({ status })
        .eq('id', chequeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast.success('Cheque status updated');
    },
    onError: (error) => {
      toast.error('Failed to update cheque: ' + error.message);
    },
  });
};
