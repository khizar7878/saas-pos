import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { warehouseSupabase } from '@/lib/warehouseSupabase';
import { playNotificationChime } from '@/utils/audio';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Edit, Clock, Package, Send, Trash2, Bell } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';

export const getNotificationIcon = (type: string) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "order_created":
      return React.createElement(ShoppingCart, { className: `${iconClass} text-blue-500` });
    case "order_edited":
      return React.createElement(Edit, { className: `${iconClass} text-amber-500` });
    case "order_processed":
      return React.createElement(Clock, { className: `${iconClass} text-indigo-500` });
    case "order_packed":
      return React.createElement(Package, { className: `${iconClass} text-emerald-500` });
    case "order_dispatched":
      return React.createElement(Send, { className: `${iconClass} text-purple-500` });
    case "order_deleted":
      return React.createElement(Trash2, { className: `${iconClass} text-destructive` });
    default:
      return React.createElement(Bell, { className: `${iconClass} text-muted-foreground` });
  }
};

export interface AppNotification {
  id: string;
  recipient_role: string;
  location_id: string | null;
  sender_id: string | null;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const useSubscribeNotifications = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data: settings } = useStoreSettings();
  const locationId = settings?.location_id;

  useEffect(() => {
    if (!isAdmin || !locationId) return;

    const db = warehouseSupabase || supabase;

    const handleNewNotification = (notification: AppNotification) => {
      playNotificationChime();

      toast(notification.title, {
        description: React.createElement('div', { style: { whiteSpace: 'pre-line' } }, notification.message),
        icon: getNotificationIcon(notification.type),
        action: {
          label: 'View',
          onClick: () => {
            db.from('notifications')
              .update({ read_at: new Date().toISOString() })
              .eq('id', notification.id)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['notifications', locationId] });
              });

            if (notification.type === 'order_packed') {
              navigate('/order-book/packed');
            } else if (notification.type === 'order_dispatched') {
              navigate('/order-book/packed');
            } else {
              navigate('/order-book/pending');
            }
          }
        }
      });

      queryClient.invalidateQueries({ queryKey: ['notifications', locationId] });
      queryClient.invalidateQueries({ queryKey: ['shop_warehouse_orders'] });
      queryClient.invalidateQueries({ queryKey: ['shop_packed_order_items'] });
      queryClient.invalidateQueries({ queryKey: ['in_transit_vouchers'] });
    };

    const uniqueChannelName = `pos-notif-${locationId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = db
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload: any) => {
          const newNotif = payload.new as AppNotification;
          const isTargetLoc = newNotif.location_id === locationId;
          const isBroadcastRole = newNotif.recipient_role === 'retail_shop' && (!newNotif.location_id || newNotif.location_id === locationId);

          if (isTargetLoc || isBroadcastRole) {
            handleNewNotification(newNotif);
          }
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [isAdmin, locationId, queryClient, navigate]);
};

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const { data: settings } = useStoreSettings();
  const locationId = settings?.location_id;

  const queryResult = useQuery({
    queryKey: ['notifications', locationId],
    queryFn: async () => {
      if (!locationId || !isAdmin) return [] as AppNotification[];
      
      const db = warehouseSupabase || supabase;
      const { data, error } = await db
        .from('notifications')
        .select('*')
        .or(`location_id.eq.${locationId},and(recipient_role.eq.retail_shop,location_id.is.null)`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AppNotification[];
    },
    enabled: !!locationId && isAdmin,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = warehouseSupabase || supabase;
      const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', locationId] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!locationId) return;
      const db = warehouseSupabase || supabase;
      const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .or(`location_id.eq.${locationId},and(recipient_role.eq.retail_shop,location_id.is.null)`)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', locationId] });
      toast.success('All notifications marked as read');
    }
  });

  return {
    ...queryResult,
    notifications: queryResult.data || [],
    unreadCount: (queryResult.data || []).filter(n => !n.read_at).length,
    markAsRead: markReadMutation.mutate,
    markAllAsRead: markAllReadMutation.mutate,
  };
};

export const useSendNotification = () => {
  return useMutation({
    mutationFn: async (payload: {
      recipient_role: string;
      location_id?: string | null;
      title: string;
      message: string;
      type: string;
      reference_id?: string | null;
    }) => {
      const db = warehouseSupabase || supabase;
      const { data: userData } = await db.auth.getUser();
      const { error } = await db
        .from('notifications')
        .insert({
          recipient_role: payload.recipient_role,
          location_id: payload.location_id || null,
          sender_id: userData?.user?.id || null,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          reference_id: payload.reference_id || null
        });

      if (error) throw error;
    }
  });
};
