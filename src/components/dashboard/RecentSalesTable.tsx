import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTodaySales } from "@/hooks/useSales";
import { format } from "date-fns";

const statusStyles = {
  completed: "bg-success/10 text-success border-success/20",
  held: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  returned: "bg-muted text-muted-foreground border-muted",
};

export function RecentSalesTable() {
  const { data: sales = [], isLoading } = useTodaySales();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-card p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card animate-slide-in w-full overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold text-foreground">Recent Sales</h3>
        <p className="text-sm text-muted-foreground">Today's transactions</p>
      </div>
      
      {/* Mobile view */}
      <div className="md:hidden">
        {sales.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No sales today</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{sale.sale_number}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "capitalize font-medium",
                      statusStyles[sale.status as keyof typeof statusStyles]
                    )}
                  >
                    {sale.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {sale.customer?.name || "Walk-in"}
                  </span>
                  <span className="font-medium">
                    Rs. {sale.total_amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(sale.created_at), 'hh:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Invoice</TableHead>
              <TableHead className="text-muted-foreground">Customer</TableHead>
              <TableHead className="text-muted-foreground">Total</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No sales today
                </TableCell>
              </TableRow>
            ) : (
              sales.slice(0, 5).map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground font-mono">
                    {sale.sale_number}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {sale.customer?.name || "Walk-in"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    Rs. {sale.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "capitalize font-medium",
                        statusStyles[sale.status as keyof typeof statusStyles]
                      )}
                    >
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {format(new Date(sale.created_at), 'hh:mm a')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}