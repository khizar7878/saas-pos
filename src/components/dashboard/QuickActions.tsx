import { ShoppingCart, Package, RotateCcw, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const actions = [
  { label: "New Sale", icon: ShoppingCart, path: "/sales", variant: "default" as const },
  { label: "Add Product", icon: Package, path: "/products", variant: "outline" as const },
  { label: "Process Return", icon: RotateCcw, path: "/returns", variant: "outline" as const },
  { label: "Receive Payment", icon: Receipt, path: "/payments", variant: "outline" as const },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card shadow-card p-5 animate-slide-in">
      <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.path}
            variant={action.variant}
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(action.path)}
          >
            <action.icon className="w-5 h-5" />
            <span className="text-sm">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}