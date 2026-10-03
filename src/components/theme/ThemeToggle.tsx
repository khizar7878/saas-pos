import { useTheme, Theme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEMES: {
  id: Theme;
  label: string;
  swatches: string[];   // bg colours shown in the palette strip
  ring: string;         // colour used for the active ring
}[] = [
  {
    id: "light",
    label: "Ocean (Default)",
    swatches: ["#ffffff", "#295975", "#3a7ea8", "#e8f4f8"],
    ring: "#295975",
  },
  {
    id: "dark",
    label: "Dark",
    swatches: ["#171717", "#b3b3b3", "#d4d4d4", "#262626"],
    ring: "#b3b3b3",
  },
  {
    id: "purple",
    label: "Violet",
    swatches: ["#ffffff", "#5e4074", "#8a66a8", "#f0ebf5"],
    ring: "#5e4074",
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 relative overflow-hidden"
          title="Change theme"
        >
          {/* Mini swatch strip on the button */}
          <span className="absolute inset-0 flex">
            {active.swatches.map((color, i) => (
              <span
                key={i}
                className="flex-1 h-full"
                style={{ background: color }}
              />
            ))}
          </span>
          <Palette className="relative z-10 h-4 w-4 drop-shadow-sm" style={{ color: active.ring }} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Appearance
        </p>
        <div className="flex flex-col gap-1.5">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors w-full text-left",
                  isActive
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                )}
              >
                {/* Palette swatch strip */}
                <span
                  className="flex h-8 w-14 rounded-md overflow-hidden border border-border shrink-0"
                  style={{ boxShadow: isActive ? `0 0 0 2px ${t.ring}` : undefined }}
                >
                  {t.swatches.map((color, i) => (
                    <span
                      key={i}
                      className="flex-1 h-full"
                      style={{ background: color }}
                    />
                  ))}
                </span>

                <span className="flex-1">
                  <span className="block text-sm font-medium leading-tight">
                    {t.label}
                  </span>
                </span>

                {isActive && (
                  <Check className="h-4 w-4 shrink-0" style={{ color: t.ring }} />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
