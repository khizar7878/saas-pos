import * as React from "react"
import { format, subDays, startOfWeek, startOfMonth, subMonths, endOfMonth } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRangePickerWithPresetsProps {
    className?: string
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
    showAllTime?: boolean
}

export function DateRangePickerWithPresets({
    className,
    date,
    setDate,
    showAllTime = true,
}: DateRangePickerWithPresetsProps) {

    const applyPreset = (preset: 'allTime' | 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last7Days' | 'last30Days') => {
        if (preset === 'allTime') {
            setDate(undefined);
            return;
        }

        const today = new Date();
        let from = today;
        let to = today;

        switch (preset) {
            case 'today':
                break;
            case 'yesterday':
                from = subDays(today, 1);
                to = subDays(today, 1);
                break;
            case 'last7Days':
                from = subDays(today, 6);
                to = today;
                break;
            case 'last30Days':
                from = subDays(today, 29);
                to = today;
                break;
            case 'thisWeek':
                from = startOfWeek(today, { weekStartsOn: 6 }); // Saturday start as per precedent
                break;
            case 'thisMonth':
                from = startOfMonth(today);
                break;
            case 'lastMonth':
                from = startOfMonth(subMonths(today, 1));
                to = endOfMonth(subMonths(today, 1));
                break;
        }
        setDate({ from, to });
    };

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
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
                            <span>{showAllTime ? "All Time" : "Pick a date"}</span>
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

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1">
                {showAllTime && (
                    <Button variant={!date?.from ? "secondary" : "outline"} size="sm" className="h-7 text-[10px] rounded-md flex-1 px-1 font-medium" onClick={() => applyPreset('allTime')}>All Time</Button>
                )}
                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-md flex-1 px-1" onClick={() => applyPreset('today')}>Today</Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-md flex-1 px-1" onClick={() => applyPreset('yesterday')}>Yesterday</Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-md flex-1 px-1" onClick={() => applyPreset('thisWeek')}>This Week</Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-md flex-1 px-1" onClick={() => applyPreset('thisMonth')}>This Month</Button>
            </div>
        </div>
    )
}
