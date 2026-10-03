import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCategory } from "@/types/database";
import { toast } from "sonner";

export interface ProductCategoryInsert {
    name: string;
    description?: string | null;
}

export const useProductCategories = () => {
    return useQuery({
        queryKey: ["product_categories"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_categories")
                .select("*")
                .order("name");

            if (error) throw error;
            return data as ProductCategory[];
        },
    });
};

export const useAddProductCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (category: ProductCategoryInsert) => {
            const { data, error } = await supabase
                .from("product_categories")
                .insert(category)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product_categories"] });
            toast.success("Category added successfully");
        },
        onError: (error: any) => {
            console.error("Add category error:", error);
            toast.error("Failed to add category: " + error.message);
        },
    });
};

export const useUpdateProductCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<ProductCategory> & { id: string }) => {
            const { data, error } = await supabase
                .from("product_categories")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product_categories"] });
            toast.success("Category updated successfully");
        },
        onError: (error: any) => {
            console.error("Update category error:", error);
            toast.error("Failed to update category: " + error.message);
        },
    });
};

export const useDeleteProductCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("product_categories")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["product_categories"] });
            toast.success("Category deleted successfully");
        },
        onError: (error: any) => {
            console.error("Delete category error:", error);
            // More specific error message for foreign key constraint violation
            if (error.code === '23503') {
                toast.error("Cannot delete category because it is assigned to products. Please reassign those products first.");
            } else {
                toast.error("Failed to delete category: " + error.message);
            }
        },
    });
};
