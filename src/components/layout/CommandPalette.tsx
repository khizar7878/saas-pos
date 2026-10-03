import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";
import { navigationConfig } from "@/config/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { hasRouteAccess } = usePermissions();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Toggle on Alt/Option + Space
      if (e.altKey && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // Toggle on Cmd/Ctrl + K (alternative shortcut)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // Filter static pages
  const allowedSections = navigationConfig
    .map((section) => {
      const items = section.items.filter((item) => hasRouteAccess(item.path));
      return {
        ...section,
        items,
      };
    })
    .filter((section) => section.items.length > 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* Glassmorphic backdrop overlay with smooth fade */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-500 data-[state=closed]:duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        
        {/* macOS Spotlight Dialog Container positioned at top-15% and scaling/fading in place without drift */}
        <DialogPrimitive.Content className="fixed left-[50%] top-[15%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-0 overflow-hidden rounded-xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-2xl ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-98 data-[state=closed]:zoom-out-98 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:duration-500 data-[state=closed]:duration-200">
          <Command
            shouldFilter={false} // Disable auto-filtering since we slice and filter in JS for performance
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-2 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4"
          >
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages..."
            />
            <CommandList className="max-h-[380px] overflow-y-auto">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                No pages found.
              </CommandEmpty>

              {/* Static Allowed Page Results */}
              {allowedSections.map((section) => {
                const matches = section.items.filter((item) => {
                  if (!search) return true;
                  return item.title.toLowerCase().includes(search.toLowerCase());
                });

                if (matches.length === 0) return null;

                return (
                  <CommandGroup key={section.title || "Main"} heading={section.title || undefined}>
                    {matches.map((item) => (
                      <CommandItem
                        key={item.path}
                        value={`page-${item.path}`}
                        onSelect={() => handleSelect(item.path)}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer transition-all duration-150 rounded-md hover:bg-primary/10 data-[selected='true']:bg-primary data-[selected='true']:text-primary-foreground group"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-muted-foreground group-data-[selected='true']:text-primary-foreground transition-transform group-data-[selected='true']:scale-110 duration-200" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </div>
                        <span className="text-[10px] opacity-0 group-data-[selected='true']:opacity-90 transition-opacity bg-background/20 px-1.5 py-0.5 rounded text-inherit font-mono">
                          ↵ Go
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
            
            {/* Spotlight-style Footer */}
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground select-none">
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/80 font-mono text-[9px] shadow-sm">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/80 font-mono text-[9px] shadow-sm">↵</kbd> Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/80 font-mono text-[9px] shadow-sm">esc</kbd> Dismiss
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-1">Toggle:</span>
                <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/80 font-mono text-[9px] shadow-sm">⌥ Space</kbd>
                <span className="text-muted-foreground/60">or</span>
                <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/80 font-mono text-[9px] shadow-sm">⌘ K</kbd>
              </div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
