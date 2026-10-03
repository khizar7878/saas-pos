import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  History,
  CreditCard,
  Receipt,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  ChevronRight,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCustomers,
  useAddCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCustomerHistory
} from "@/hooks/useCustomers";
import { format } from "date-fns";
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
import { PAKISTAN_CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const Customers = () => {
  const { data: customers = [], isLoading } = useCustomers();
  const navigate = useNavigate();
  const addCustomer = useAddCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    credit_limit: "",
    opening_balance: "",
  });

  const { data: customerHistory } = useCustomerHistory(selectedCustomerId);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalReceivable = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      credit_limit: "",
      opening_balance: "",
    });
  };

  const handleAddCustomer = async () => {
    if (!formData.name.trim()) return;

    await addCustomer.mutateAsync({
      name: formData.name.trim(),
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      city: formData.city || null,
      credit_limit: parseFloat(formData.credit_limit) || 0,
      opening_balance: parseFloat(formData.opening_balance) || 0,
    });

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomerId || !formData.name.trim()) return;

    await updateCustomer.mutateAsync({
      id: selectedCustomerId,
      name: formData.name.trim(),
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      city: formData.city || null,
      credit_limit: parseFloat(formData.credit_limit) || 0,
    });

    resetForm();
    setIsEditDialogOpen(false);
    setSelectedCustomerId(null);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  const openEditDialog = (customer: typeof customers[0]) => {
    setSelectedCustomerId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      city: customer.city || "",
      credit_limit: customer.credit_limit?.toString() || "",
      opening_balance: "",
    });
    setIsEditDialogOpen(true);
  };

  const openHistory = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setIsHistoryOpen(true);
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Manage your customer accounts and history
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>
                Enter customer details to create a new account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  placeholder="Customer name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="03XX-XXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>City</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !formData.city && "text-muted-foreground"
                      )}
                    >
                      {formData.city
                        ? formData.city
                        : "Select city..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search city..." />
                      <CommandList>
                        <CommandEmpty>No city found.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[200px]">
                            {PAKISTAN_CITIES.map((city) => (
                              <CommandItem
                                value={city}
                                key={city}
                                onSelect={() => {
                                  setFormData({ ...formData, city: city });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.city === city
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {city}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Textarea
                  placeholder="Full address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomer} disabled={addCustomer.isPending}>
                {addCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-primary text-primary-foreground shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-primary-foreground/80">Total Customers</p>
              <p className="text-2xl font-semibold">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Receivable</p>
              <p className="text-2xl font-semibold text-warning">Rs. {totalReceivable.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customers List */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="rounded-xl border border-border bg-card shadow-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={customer.current_balance > 0
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-success/10 text-success border-success/20"
                  }
                >
                  Rs. {customer.current_balance.toLocaleString()}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openHistory(customer.id)}
                >
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(customer)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCustomer(customer.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Customer</TableHead>
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-muted-foreground">Balance</TableHead>
                <TableHead className="text-muted-foreground">Credit Limit</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p
                          className="font-medium text-foreground hover:underline cursor-pointer"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                        >
                          {customer.name}
                        </p>
                        {customer.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {customer.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.phone && (
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {customer.phone}
                        </p>
                      )}
                      {customer.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={customer.current_balance > 0
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-success/10 text-success border-success/20"
                      }
                    >
                      Rs. {customer.current_balance.toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    Rs. {(customer.credit_limit || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHistory(customer.id)}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomer(customer.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                placeholder="Customer name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>City</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !formData.city && "text-muted-foreground"
                    )}
                  >
                    {formData.city
                      ? formData.city
                      : "Select city..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search city..." />
                    <CommandList>
                      <CommandEmpty>No city found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-[200px]">
                          {PAKISTAN_CITIES.map((city) => (
                            <CommandItem
                              value={city}
                              key={city}
                              onSelect={() => {
                                setFormData({ ...formData, city: city });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.city === city
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {city}
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea
                placeholder="Full address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Credit Limit</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCustomer} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {selectedCustomer?.name}
            </SheetTitle>
            <SheetDescription>
              Purchase and payment history
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <Tabs defaultValue="purchases">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="purchases" className="gap-2">
                  <Receipt className="w-4 h-4" />
                  Purchases
                </TabsTrigger>
                <TabsTrigger value="payments" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="purchases" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {customerHistory?.sales?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>No purchase history</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerHistory?.sales?.map((sale: any) => (
                        <div key={sale.id} className="p-3 rounded-lg border border-border">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">{sale.sale_number}</span>
                            <Badge variant="outline">
                              {sale.payment_method}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(sale.created_at), 'dd MMM yyyy')}
                            </span>
                            <span className="font-semibold">
                              Rs. {sale.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {customerHistory?.payments?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>No payment history</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerHistory?.payments?.map((payment: any) => (
                        <div key={payment.id} className="p-3 rounded-lg border border-border">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">{payment.payment_number}</span>
                            <Badge variant="outline" className="uppercase">
                              {payment.payment_mode}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'dd MMM yyyy')}
                            </span>
                            <span className="font-semibold text-success">
                              Rs. {payment.amount.toLocaleString()}
                            </span>
                          </div>
                          {payment.to_account && (
                            <p className="text-xs text-muted-foreground mt-1">
                              → {payment.to_account.name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Customers;
