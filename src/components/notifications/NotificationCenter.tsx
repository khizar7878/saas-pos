import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { Bell, Check, ShoppingCart, Package, Send, Edit, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (err) {
    return "";
  }
}

function NotificationIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "order_created":
      return <ShoppingCart className={cn(iconClass, "text-blue-500")} />;
    case "order_edited":
      return <Edit className={cn(iconClass, "text-amber-500")} />;
    case "order_processed":
      return <Clock className={cn(iconClass, "text-indigo-500")} />;
    case "order_packed":
      return <Package className={cn(iconClass, "text-emerald-500")} />;
    case "order_dispatched":
      return <Send className={cn(iconClass, "text-purple-500")} />;
    case "order_deleted":
      return <Trash2 className={cn(iconClass, "text-destructive")} />;
    default:
      return <Bell className={cn(iconClass, "text-muted-foreground")} />;
  }
}

interface NotificationCenterProps {
  className?: string;
  triggerSize?: "default" | "sm" | "icon";
}

export default function NotificationCenter({ className, triggerSize = "icon" }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    setOpen(false);

    if (notification.type === "order_packed") {
      navigate("/order-book/packed");
    } else if (notification.type === "order_dispatched") {
      navigate("/order-book/packed");
    } else {
      navigate("/order-book/pending");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 active:scale-95",
            className
          )}
        >
          <Bell className="w-[22px] h-[22px] text-sidebar-muted group-hover:scale-110 transition-transform" strokeWidth={2.3} />
          {unreadCount > 0 && (
            <>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full animate-ping opacity-75" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary text-[8px] font-extrabold text-primary-foreground rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 sm:w-96 p-0 mr-4 mt-2 bg-card/95 backdrop-blur-md border border-border/40 shadow-xl rounded-xl z-50 animate-fade-in" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5 px-2 h-7"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="overflow-y-auto max-h-[380px] divide-y divide-border/20">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p>All caught up!</p>
              <p className="text-[10px] text-muted-foreground/60">No recent order notifications.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "p-4 cursor-pointer hover:bg-muted/40 transition-colors flex gap-3 text-left relative",
                  !notif.read_at && "bg-primary/5 hover:bg-primary/8"
                )}
              >
                {!notif.read_at && (
                  <span className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full" />
                )}

                <div className="w-8 h-8 rounded-lg bg-muted/40 border border-border/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <NotificationIcon type={notif.type} />
                </div>

                <div className="flex-1 min-w-0 pr-3">
                  <h4 className="text-xs font-bold text-foreground truncate pr-1">
                    {notif.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words whitespace-pre-line">
                    {notif.message}
                  </p>
                  <span className="text-[9px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(notif.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border/20 bg-muted/10 text-center">
          <p className="text-[9px] text-muted-foreground/50">Showing last 50 order notifications (auto-cleanup after 30 days)</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
