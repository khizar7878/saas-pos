import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreditSale } from "@/types/database";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";

const DeliveredBills = () => {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date()
    });
    const [searchTerm, setSearchTerm] = useState("");

    const { data: deliveredBills = [], isLoading } = useQuery({
        queryKey: ['delivered_bills', date?.from?.toISOString(), date?.to?.toISOString()],
        queryFn: async () => {
            let query = supabase
                .from('credit_sales')
                .select('*')
                .eq('status', 'delivered')
                .order('created_at', { ascending: false });

            if (date?.from) {
                const start = new Date(date.from);
                start.setHours(0, 0, 0, 0);
                query = query.gte('created_at', start.toISOString());
            }
            if (date?.to) {
                const end = new Date(date.to);
                end.setHours(23, 59, 59, 999);
                query = query.lte('created_at', end.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as CreditSale[];
        }
    });

    const filteredBills = deliveredBills.filter(bill =>
        bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderItemsList = (items: any[]) => {
        return (
            <ul className="list-disc pl-4 text-xs space-y-1">
                {items.map((item, idx) => (
                    <li key={idx}>
                        {item.product_name}
                        <span className="text-muted-foreground ml-1">x {item.quantity}</span>
                    </li>
                ))}
            </ul>
        );
    };

    if (isLoading) {
        return <div className="p-6 flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Delivered Bills</h1>
                        <p className="text-muted-foreground">View bills marked as delivered (no payment)</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[300px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y")} -{" "}
                                            {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    <Input
                        placeholder="Search by bill # or customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Bill Number</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="w-[40%]">Items Description</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredBills.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No delivered bills found for this date</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredBills.map((bill) => (
                                <TableRow key={bill.id} className="hover:bg-muted/50">
                                    <TableCell className="text-muted-foreground align-top">
                                        {format(new Date(bill.created_at), 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell className="font-mono font-medium align-top">
                                        {bill.bill_number}
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="font-medium">{bill.customer_name}</div>
                                        <div className="text-xs text-muted-foreground">{bill.customer_phone}</div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        {renderItemsList(bill.items as any[])}
                                    </TableCell>
                                    <TableCell className="text-right font-bold align-top">
                                        Rs. {bill.total_amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center align-top">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            Delivered
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default DeliveredBills;
