import { useState, useEffect } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  ChevronDown,
  LogOut,
  LucideIcon,
  ShoppingCart,
  Receipt,
  Warehouse,
  BookOpen,
  Landmark,
  Settings,
  Wrench
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { navigationConfig, NavSection, NavItem } from "@/config/navigation";
import { useRouteSync } from "@/hooks/useRouteSync";

export function AppSidebar() {
  // Trigger Auto-Sync for Admins
  useRouteSync();

  const [collapsed, setCollapsed] = useState(false);
  // Flatten sections state: { "Point of Sale": true, "Reports": false }
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Point of Sale": false,
    "Reports": false,
    "Inventory": false,
    "Accounts": false,
    "Setup": false,
  });

  const [signOutOpen, setSignOutOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { userProfile, isAdmin, hasRouteAccess, loading: permissionsLoading } = usePermissions();
  const [pendingDevicesCount, setPendingDevicesCount] = useState(0);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const isExpanded = prev[title];

      if (isExpanded) {
        // If already expanded, just collapse it
        return { ...prev, [title]: false };
      }

      // If opening, close all others first
      const newState = Object.keys(prev).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);

      newState[title] = true;
      return newState;
    });
  };

  /* Trusted devices logic removed as per request */
  useEffect(() => {
    // No-op for now
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setSignOutOpen(false);
  };

  const handleSwitchProfile = () => {
    // For now, switch profile will sign out and redirect to login
    // In a full implementation, this would show a profile picker
    handleSignOut();
  };

  // Filter items based on permissions
  const getFilteredSection = (section: NavSection) => {
    if (permissionsLoading) return { ...section, items: [] };
    const filteredItems = section.items.filter(item => hasRouteAccess(item.path));
    return { ...section, items: filteredItems };
  };


  return (
    <TooltipProvider>
      <aside
        className={cn(
          "h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out print:hidden",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo Area with Collapse Toggle */}
        <div className="p-4 border-b border-sidebar-border">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="text-sidebar-foreground font-semibold text-sm leading-tight truncate" title={userProfile?.full_name || user?.email}>
                  {userProfile?.full_name || user?.email?.split('@')[0]}
                </h1>
                <p className="text-sidebar-muted text-xs">
                  {userProfile?.custom_role_name || (isAdmin ? 'Administrator' : 'Staff Member')}
                </p>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-primary-foreground" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-primary-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navigationConfig.map((section, index) => {
            const filteredSection = getFilteredSection(section);
            if (filteredSection.items.length === 0) return null;

            // Render Main Section (No collapsible header, just items)
            if (section.title === "Main") {
              return (
                <div key={section.title || index} className="space-y-1 mb-2">
                  {filteredSection.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className={cn(
                          "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                          !isActive && "group-hover:scale-110"
                        )} />
                        {!collapsed && (
                          <span className="text-sm font-medium animate-slide-down">
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            }

            // Render Collapsible Section
            const isExpanded = expandedSections[section.title!] || false;
            // Check if any child is active to highlight section header
            const isSectionActive = filteredSection.items.some(
              item => location.pathname.startsWith(item.path)
            );

            return (
              <Collapsible
                key={section.title || index}
                open={!collapsed && isExpanded}
                onOpenChange={() => !collapsed && toggleSection(section.title!)}
                className="pt-2"
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group Select-none",
                      isSectionActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {/* Icons */}
                    {section.title === "Point of Sale" && <ShoppingCart className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Reports" && <Receipt className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Inventory" && <Warehouse className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Accounts" && <BookOpen className="w-5 h-5 flex-shrink-0" />}

                    {section.title === "Setup" && <Settings className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Utilities" && <Wrench className="w-5 h-5 flex-shrink-0" />}

                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left animate-slide-down">
                          {section.title}
                        </span>
                        {section.title === "Setup" && pendingDevicesCount > 0 && (
                          <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse mr-2" />
                        )}
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-border pl-3">
                    {filteredSection.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group text-sm",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>


        {/* User Info & Actions */}
        <div className="p-3 border-t border-sidebar-border space-y-3">
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-sidebar-muted truncate animate-fade-in">
              <div className="flex items-center gap-1">
                {isAdmin && <span className="text-primary font-medium">Admin:</span>}
                {user.email}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className={cn(
            "flex gap-2",
            collapsed ? "flex-col items-center" : "justify-center"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSwitchProfile}
                  className={cn(
                    "flex items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all active:scale-95",
                    collapsed ? "w-10 h-10" : "flex-1 h-10"
                  )}
                >
                  <UserCircle className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                <p>Switch Profile</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSignOutOpen(true)}
                  className={cn(
                    "flex items-center justify-center rounded-lg text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95",
                    collapsed ? "w-10 h-10" : "flex-1 h-10"
                  )}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                <p>Sign Out</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

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
      </aside>
    </TooltipProvider>
  );
}
