import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SpreadsheetRecord {
  id: string;
  name: string;
  data: any[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSpreadsheets = () => {
  return useQuery({
    queryKey: ["spreadsheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spreadsheets")
        .select("id, name, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Pick<SpreadsheetRecord, "id" | "name" | "created_at" | "updated_at">[];
    },
  });
};

export const useSpreadsheet = (id: string | null) => {
  return useQuery({
    queryKey: ["spreadsheet", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spreadsheets")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as SpreadsheetRecord;
    },
  });
};

export const useCreateSpreadsheet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("spreadsheets")
        .insert({ name, data: [], created_by: user?.id })
        .select("id, name, created_at, updated_at")
        .single();
      if (error) throw error;
      return data as Pick<SpreadsheetRecord, "id" | "name" | "created_at" | "updated_at">;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheets"] });
    },
    onError: (e) => toast.error("Failed to create spreadsheet: " + e.message),
  });
};

export const useSaveSpreadsheet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, data }: { id: string; name: string; data: any[] }) => {
      const { error } = await supabase
        .from("spreadsheets")
        .update({ name, data })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheets"] });
      queryClient.invalidateQueries({ queryKey: ["spreadsheet", variables.id] });
      toast.success("Spreadsheet saved");
    },
    onError: (e) => toast.error("Failed to save: " + e.message),
  });
};

export const useDeleteSpreadsheet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spreadsheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheets"] });
      toast.success("Spreadsheet deleted");
    },
    onError: (e) => toast.error("Failed to delete: " + e.message),
  });
};
