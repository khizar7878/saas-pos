import { User, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCustomers } from "@/hooks/useCustomers";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  city?: string | null;
  address?: string | null;
  current_balance?: number;
}

interface CustomerDetailsProps {
  selectedCustomer: Customer;
  onCustomerChange: (customer: Customer) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CustomerDetails = ({ selectedCustomer, onCustomerChange, isOpen, onOpenChange }: CustomerDetailsProps) => {
  const { data: customers = [], isLoading } = useCustomers();
  const [internalOpen, setInternalOpen] = useState(false);

  // Controlled or uncontrolled open state
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Build list with Walk-in first, then DB customers
  const allCustomers: Customer[] = [
    { id: "walk-in", name: "Walk-in Customer" },
    ...customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      city: c.city,
      address: c.address,
      current_balance: c.current_balance,
    })),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <User className="w-4 h-4 text-primary" />
        Customer
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between group",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary", // Hover effect
              open && "border-primary ring-1 ring-primary" // Active state
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={cn(
                "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center transition-colors",
                "group-hover:bg-primary-foreground/20" // Icon background adjustment on hover
              )}>
                <User className={cn(
                  "w-4 h-4 text-primary transition-colors",
                  "group-hover:text-primary-foreground" // Icon turns white
                )} />
              </div>
              <div className="text-left flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.phone && (
                  <span className={cn(
                    "text-xs text-muted-foreground truncate transition-colors",
                    "group-hover:text-primary-foreground" // Subtext turns white
                  )}>
                    {selectedCustomer.phone}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className={cn(
              "ml-2 h-4 w-4 shrink-0 opacity-50 transition-colors",
              "group-hover:text-primary-foreground group-hover:opacity-100" // Arrow turns white
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search customer..." />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {allCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.name}
                    onSelect={() => {
                      onCustomerChange(customer);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedCustomer.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-1 items-center gap-2 overflow-hidden">
                      <span className="font-medium truncate flex-[2]">{customer.name}</span>
                      {customer.phone && (
                        <span className="text-xs opacity-70 truncate flex-1">{customer.phone}</span>
                      )}
                      {customer.city && (
                        <span className="text-xs opacity-70 truncate flex-1 block">{customer.city}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CustomerDetails;
