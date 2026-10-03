import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary";
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default" 
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-5 transition-all duration-200 hover:shadow-card-md animate-slide-in",
        variant === "primary"
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border shadow-card"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn(
            "text-sm font-medium",
            variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-xs",
              variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? "+" : ""}{trend.value}% from last month
            </p>
          )}
        </div>
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          variant === "primary"
            ? "bg-primary-foreground/10"
            : "bg-primary/10"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            variant === "primary" ? "text-primary-foreground" : "text-primary"
          )} />
        </div>
      </div>
    </div>
  );
}