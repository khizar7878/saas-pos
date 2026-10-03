import { useState } from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  UserCircle,
  ShoppingCart,
  Receipt,
  Warehouse,
  BookOpen,
  Settings,
  Wrench,
  Store,
  Scale
} from "lucide-react";
import NotificationCenter from "../notifications/NotificationCenter";
import { IntercomCallWidget } from "../intercom/IntercomCallWidget";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { navigationConfig, NavSection } from "@/config/navigation";

const sectionIcons: Record<string, any> = {
  "Point of Sale": ShoppingCart,
  "Online Store": Store,
  "Order Book": BookOpen,
  "Reports": Receipt,
  "Reconciliation": Scale,
  "Inventory": Warehouse,
  "Accounts": BookOpen,
  "Utilities": Wrench,
  "Setup": Settings,
};

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [signOutOpen, setSignOutOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, hasRouteAccess, loading: permissionsLoading } = usePermissions();

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    setSignOutOpen(false);
    setIsOpen(false);
  };

  const getFilteredSection = (section: NavSection) => {
    if (permissionsLoading) return { ...section, items: [] };
    const filteredItems = section.items.filter(item => hasRouteAccess(item.path));
    return { ...section, items: filteredItems };
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">AK</span>
          </div>
          <span className="font-semibold text-foreground">Abr e Karam</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <NotificationCenter />
              <IntercomCallWidget isMobileHeader={true} />
            </>
          )}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border flex-shrink-0">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navigationConfig.map((section, index) => {
                  const filteredSection = getFilteredSection(section);
                  if (filteredSection.items.length === 0) return null;

                  if (section.title === "Main") {
                    return (
                      <div key={section.title || index} className="space-y-1 mb-2">
                        {filteredSection.items.map((item) => {
                          const isActive = location.pathname === item.path;
                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <item.icon className="w-5 h-5 flex-shrink-0" />
                              <span className="text-sm font-medium">{item.title}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    );
                  }

                  const isExpanded = expandedSections[section.title!] || false;
                  const SectionIcon = sectionIcons[section.title!] || Store;
                  const isSectionActive = filteredSection.items.some(
                    item => location.pathname.startsWith(item.path)
                  );

                  return (
                    <div key={section.title || index} className="pt-1">
                      <button
                        onClick={() => toggleSection(section.title!)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                          isSectionActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <SectionIcon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1 text-left">{section.title}</span>
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-3">
                          {filteredSection.items.map((item) => {
                            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));
                            return (
                              <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                  "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm",
                                  isActive
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <item.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="font-medium">{item.title}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* User Actions */}
              <div className="p-4 border-t border-border bg-background flex-shrink-0">
                {user && (
                  <p className="text-xs text-muted-foreground mb-3 truncate">
                    {isAdmin && <span className="text-primary font-medium">Admin: </span>}
                    {user.email}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsOpen(false);
                      handleSignOut();
                    }}
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    Switch
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      setIsOpen(false);
                      setSignOutOpen(true);
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You will need to log in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}