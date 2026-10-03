import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeldCart } from "@/components/sales/HeldCartTabs";

export type PageType = 'sales' | 'forwarding';

export const useHeldCarts = (pageType?: PageType) => {
    const queryClient = useQueryClient();

    const { data: heldCarts = [], isLoading } = useQuery({
        queryKey: ["held_carts", pageType],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Build query
            let query = supabase.from("held_carts").select("*");
            // If pageType is 'sales' or undefined, we want:
            // 1. Private holds (page_type=sales AND created_by=user)
            // 2. Forwarded carts (page_type=forwarding) - visible to everyone
            // 3. Assigned carts (assigned_to=user)

            // If pageType is 'sales', show carts created by me OR assigned to me
            // If pageType is 'sales', show:
            // 1. Carts created by me AND NOT assigned to anyone (Private drafts)
            // 2. Carts assigned to me (Forwarded to me)
            if (!pageType || pageType === 'sales') {
                query = query.or(`and(created_by.eq.${user.id},assigned_to.is.null),assigned_to.eq.${user.id}`);
            } else {
                query = query.eq('page_type', pageType)
                    .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
            }

            const { data, error } = await query.order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching held carts:", error);
                toast.error("Failed to load held carts");
                return [];
            }

            // Map DB structure to UI structure
            return data.map((cart: any) => ({
                id: cart.id,
                items: cart.cart_data || [],
                customerName: cart.cart_name,
                customerId: cart.customer_id,
                timestamp: new Date(cart.created_at),
                subtotal: cart.total_amount,
                assignedTo: cart.assigned_to
            })) as HeldCart[];
        },
    });

    // Real-time updates subscription
    useEffect(() => {
        const channelName = `held_carts_updates_${Date.now()}`; // Unique channel name per mount
        console.log(`Setting up realtime subscription: ${channelName}`);

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'held_carts' },
                async (payload) => {
                    console.log('🔔 Held cart change detected:', payload);
                    console.log('Refetching held_carts queries...');

                    // Immediately refetch all held_carts queries
                    const result = await queryClient.refetchQueries({
                        queryKey: ["held_carts"],
                        type: 'active'
                    });

                    console.log('✅ Refetch completed:', result);
                }
            )
            .subscribe((status) => {
                console.log(`Subscription status for ${channelName}:`, status);
            });

        return () => {
            console.log(`Cleaning up subscription: ${channelName}`);
            supabase.removeChannel(channel);
        };
    }, [queryClient, pageType]);

    const createHeldCart = useMutation({
        mutationFn: async ({
            items,
            customerName,
            customerId,
            subtotal,
            assignedTo,
            pageType: cartPageType
        }: Omit<HeldCart, "id" | "timestamp"> & { assignedTo?: string; pageType?: PageType }) => {

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Determine the final page_type
            let finalPageType = cartPageType || pageType || 'sales';

            // If forwarding to another user, determine their appropriate page_type
            if (assignedTo) {
                const { data: recipientPageType, error: rpcError } = await supabase
                    .rpc('get_user_page_type_for_cart', { _user_id: assignedTo });

                if (!rpcError && recipientPageType) {
                    finalPageType = recipientPageType as PageType;
                } else {
                    finalPageType = 'forwarding';
                }
            }

            const { data, error } = await supabase
                .from("held_carts")
                .insert({
                    cart_name: customerName,
                    customer_id: customerId === "walk-in" ? null : customerId,
                    cart_data: items as any, // Json type
                    total_amount: subtotal,
                    assigned_to: assignedTo || null,
                    created_by: user.id,
                    page_type: finalPageType
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onMutate: async (newCart) => {
            const queryKey = ["held_carts", pageType];
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousHeldCarts = queryClient.getQueryData<HeldCart[]>(queryKey);

            // Optimistically update to the new value
            const optimisticCart: HeldCart = {
                id: `temp-${Date.now()}`, // Temporary ID
                items: newCart.items,
                customerName: newCart.customerName,
                customerId: newCart.customerId,
                timestamp: new Date(),
                subtotal: newCart.subtotal,
                assignedTo: newCart.assignedTo
            };

            queryClient.setQueryData<HeldCart[]>(queryKey, (old) => {
                return [optimisticCart, ...(old || [])];
            });

            // Return a context object with the snapshotted value
            return { previousHeldCarts, queryKey };
        },
        onError: (err, newCart, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previousHeldCarts);
            }
            console.error("Error holding cart:", err);
            toast.error("Failed to hold cart: " + err.message);
        },
        onSettled: (data, error, variables, context) => {
            // Always refetch after error or success:
            if (context?.queryKey) {
                queryClient.invalidateQueries({ queryKey: context.queryKey });
            }
        },
    });

    const deleteHeldCart = useMutation({
        mutationFn: async (cartId: string) => {
            const { error } = await supabase
                .from("held_carts")
                .delete()
                .eq("id", cartId);

            if (error) throw error;
        },
        onMutate: async (cartId) => {
            const queryKey = ["held_carts", pageType];
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousHeldCarts = queryClient.getQueryData<HeldCart[]>(queryKey);

            // Optimistically update
            queryClient.setQueryData<HeldCart[]>(queryKey, (old) => {
                return (old || []).filter(cart => cart.id !== cartId);
            });

            // Return a context object with the snapshotted value
            return { previousHeldCarts, queryKey };
        },
        onError: (err, cartId, context) => {
            if (context?.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previousHeldCarts);
            }
            console.error("Error deleting held cart:", err);
            toast.error("Failed to delete held cart");
        },
        onSettled: (data, error, variables, context) => {
            if (context?.queryKey) {
                queryClient.invalidateQueries({ queryKey: context.queryKey });
            }
        },
    });

    return {
        heldCarts,
        isLoading,
        createHeldCart,
        deleteHeldCart
    };
};
