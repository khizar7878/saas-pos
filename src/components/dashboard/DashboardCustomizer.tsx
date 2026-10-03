import { useState } from "react";
import { Settings, GripVertical, Eye, EyeOff, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WidgetConfig, WidgetSize, useDashboardLayout } from "@/hooks/useDashboardLayout";

interface DashboardCustomizerProps {
  widgets: WidgetConfig[];
  onToggleWidget: (id: string) => void;
  onChangeSize: (id: string, size: WidgetSize) => void;
  onReset: () => void;
}

const widgetLabels: Record<string, string> = {
  sales_today: "Today's Sales",
  cash_sales: "Cash Sales",
  card_sales: "Card Sales",
  ibft_sales: "IBFT Sales",
  weekly_sales: "Weekly Sales Chart",
  top_products: "Top Products Chart",
  top_categories: "Top Categories Chart",
  total_revenue: "Total Revenue",
  products: "Products Count",
  customers: "Customers Count",
  recent_sales: "Recent Sales Table",
  quick_actions: "Quick Actions",
  low_stock: "Low Stock Alert",
  cash_in_hand: "Cash in Hand",
};

const sizeLabels: Record<WidgetSize, string> = {
  small: "Small (1 col)",
  medium: "Medium (1 col)",
  large: "Large (2 cols)",
};

export function DashboardCustomizer({
  widgets,
  onToggleWidget,
  onChangeSize,
  onReset,
}: DashboardCustomizerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Show/hide widgets and adjust their sizes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                widget.visible ? "border-border bg-card" : "border-dashed border-muted bg-muted/30"
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />

              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  !widget.visible && "text-muted-foreground"
                )}>
                  {widgetLabels[widget.type] || widget.type}
                </p>
              </div>

              <Select
                value={widget.size}
                onValueChange={(value) => onChangeSize(widget.id, value as WidgetSize)}
                disabled={!widget.visible}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>

              <Switch
                checked={widget.visible}
                onCheckedChange={() => onToggleWidget(widget.id)}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1">
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} className="gap-1">
            <Check className="w-3 h-3" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
