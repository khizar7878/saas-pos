import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const lowStockItems = [
  { name: "Lawn Cotton - Blue", stock: 3, unit: "meters" },
  { name: "Silk Chiffon - Pink", stock: 5, unit: "meters" },
  { name: "Velvet - Maroon", stock: 2, unit: "meters" },
  { name: "Organza - White", stock: 4, unit: "meters" },
];

export function LowStockAlert() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card p-5 animate-slide-in">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="font-semibold text-foreground">Low Stock Alert</h3>
      </div>
      <div className="space-y-3">
        {lowStockItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
          >
            <span className="text-sm font-medium text-foreground">{item.name}</span>
            <span className={cn(
              "text-xs font-semibold px-2 py-1 rounded",
              item.stock <= 2 
                ? "bg-destructive/10 text-destructive" 
                : "bg-warning/10 text-warning"
            )}>
              {item.stock} {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}