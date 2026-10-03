import { Grid2X2, Grid3X3, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type GridLayout = "2x2" | "3x3" | "4x4" | "2x4";

interface GridViewSelectorProps {
  currentLayout: GridLayout;
  onLayoutChange: (layout: GridLayout) => void;
}

const gridOptions: { id: GridLayout; label: string; icon: typeof Grid2X2; cols: string }[] = [
  { id: "2x2", label: "2 × 2", icon: Grid2X2, cols: "2 columns" },
  { id: "3x3", label: "3 × 3", icon: Grid3X3, cols: "3 columns" },
  { id: "4x4", label: "4 × 4", icon: LayoutGrid, cols: "4 columns" },
  { id: "2x4", label: "2 × 4", icon: LayoutGrid, cols: "4 columns (compact)" },
];

const GridViewSelector = ({ currentLayout, onLayoutChange }: GridViewSelectorProps) => {
  const currentOption = gridOptions.find(opt => opt.id === currentLayout) || gridOptions[1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <currentOption.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{currentOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {gridOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => onLayoutChange(option.id)}
            className={cn(
              "gap-2",
              currentLayout === option.id && "bg-primary/10 text-primary"
            )}
          >
            <option.icon className="w-4 h-4" />
            <div>
              <p className="font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.cols}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GridViewSelector;
