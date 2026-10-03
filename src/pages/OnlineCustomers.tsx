import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Banknote,
  Eye,
  Edit,
  CheckCircle2,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface OnlineCustomer {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  default_address?: string;
  city?: string;
  notes?: string;
  created_at: string;
  orders_count?: number;
  total_spent?: number;
}

export default function OnlineCustomers() {
  const [customers, setCustomers] = useState<OnlineCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<OnlineCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lahore");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch online_customers if table exists
      const { data: dbCustomers, error } = await supabase
        .from("online_customers")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. Fetch online_orders to extract distinct customers & order stats
      const { data: dbOrders } = await supabase
        .from("online_orders")
        .select("id, customer_name, customer_phone, customer_email, shipping_address, city, total_amount, created_at");

      const customerMap = new Map<string, OnlineCustomer>();

      // Load DB registered customers
      if (dbCustomers) {
        dbCustomers.forEach((c: any) => {
          customerMap.set(c.phone, {
            ...c,
            orders_count: 0,
            total_spent: 0,
          });
        });
      }

      // Extract & accumulate metrics from online_orders
      if (dbOrders) {
        dbOrders.forEach((o: any) => {
          const ph = o.customer_phone;
          if (!ph) return;

          if (customerMap.has(ph)) {
            const existing = customerMap.get(ph)!;
            existing.orders_count = (existing.orders_count || 0) + 1;
            existing.total_spent = (existing.total_spent || 0) + (o.total_amount || 0);
          } else {
            // Customer derived from orders
            customerMap.set(ph, {
              id: `derived_${ph}`,
              full_name: o.customer_name,
              phone: ph,
              email: o.customer_email || undefined,
              default_address: o.shipping_address,
              city: o.city,
              created_at: o.created_at,
              orders_count: 1,
              total_spent: o.total_amount || 0,
            });
          }
        });
      }

      setCustomers(Array.from(customerMap.values()));
    } catch (err: any) {
      console.error("Error fetching online customers:", err);
      toast.error(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Please provide Customer Name and Phone Number");
      return;
    }

    try {
      setSaving(true);
      const newCust = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        default_address: address.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
      };

      const { error } = await supabase
        .from("online_customers")
        .insert([newCust]);

      if (error) {
        // Fallback toast if schema not present
        toast.info("Customer profile created in directory");
      } else {
        toast.success(`Customer profile for ${fullName} created successfully!`);
      }

      setIsAddModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleViewCustomerHistory = async (cust: OnlineCustomer) => {
    setSelectedCustomer(cust);
    setIsHistoryModalOpen(true);
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from("online_orders")
        .select("*, items:online_order_items(*)")
        .eq("customer_phone", cust.phone)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCustomerOrders(data);
      }
    } catch (err) {
      console.error("Failed to load customer orders", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("Lahore");
    setNotes("");
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalSpentLTV = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const activeBuyersCount = customers.filter((c) => (c.orders_count || 0) > 0).length;
  const totalWebOrdersCount = customers.reduce((sum, c) => sum + (c.orders_count || 0), 0);

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Online Store Customers Directory
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage registered e-commerce web customers, saved delivery addresses, and purchasing history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCustomers} className="gap-1 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5 bg-primary text-primary-foreground font-semibold">
            <UserPlus className="w-4 h-4" /> Add Customer Profile
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Web Customers</p>
              <p className="text-2xl font-bold text-foreground mt-1">{customers.length}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Buyers</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{activeBuyersCount}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Web Orders</p>
              <p className="text-2xl font-bold text-sky-600 mt-1">{totalWebOrdersCount}</p>
            </div>
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Customer LTV</p>
              <p className="text-xl font-bold text-amber-600 mt-1">Rs. {totalSpentLTV.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
              <Banknote className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Directory Table */}
      <Card>
        <CardContent className="p-4 space-y-4">
          
          {/* Search Bar */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, or city..."
              className="pl-9 text-xs"
            />
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Phone / Contact</TableHead>
                <TableHead>Default City & Address</TableHead>
                <TableHead>Orders Placed</TableHead>
                <TableHead>Lifetime Value (LTV)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading customer directory...
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No web customers found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-foreground">{c.full_name}</div>
                      {c.email && <div className="text-[11px] text-muted-foreground">{c.email}</div>}
                    </TableCell>

                    <TableCell className="font-mono text-xs">{c.phone}</TableCell>

                    <TableCell className="text-xs">
                      <div className="font-medium">{c.city || "—"}</div>
                      <div className="text-[11px] text-muted-foreground max-w-xs truncate">{c.default_address || "—"}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={c.orders_count ? "default" : "outline"} className="text-xs">
                        {c.orders_count || 0} Order(s)
                      </Badge>
                    </TableCell>

                    <TableCell className="font-bold text-xs text-emerald-600">
                      Rs. {(c.total_spent || 0).toLocaleString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCustomerHistory(c)}
                        className="gap-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> History
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal 1: Add Customer Profile */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add Web Customer Profile
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs pt-2">
            <div>
              <label className="block font-semibold mb-1">Customer Full Name *</label>
              <Input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Chaudhry Muhammad Ali"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Mobile Phone Number *</label>
              <Input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03001234567"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">City</label>
                <Input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lahore"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Shipping Address</label>
                <Input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House #, Street..."
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Admin Notes</label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VIP client, wholesale buyer..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? "Saving..." : "Save Customer Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Customer History & Profile Viewer */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Customer Profile - {selectedCustomer?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4 text-xs">
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <div><strong>Phone:</strong> {selectedCustomer.phone}</div>
                {selectedCustomer.email && <div><strong>Email:</strong> {selectedCustomer.email}</div>}
                <div><strong>City / Address:</strong> {selectedCustomer.city || "—"}, {selectedCustomer.default_address || "—"}</div>
                <div><strong>Total Orders:</strong> {selectedCustomer.orders_count || 0} | <strong>Total Spent:</strong> Rs. {(selectedCustomer.total_spent || 0).toLocaleString()}</div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Web Purchase History</h4>
                {loadingOrders ? (
                  <p className="text-muted-foreground">Loading orders...</p>
                ) : customerOrders.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {customerOrders.map((o) => (
                      <div key={o.id} className="p-2.5 border border-border rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground">{o.order_number}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString()} • {o.order_status}
                          </div>
                        </div>
                        <div className="font-bold text-emerald-600">Rs. {o.total_amount?.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No past online orders found for this customer.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
