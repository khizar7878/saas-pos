import { useRef } from "react";
import { cn } from "@/lib/utils";
import { WidgetConfig, WidgetSize } from "@/hooks/useDashboardLayout";

interface DraggableWidgetProps {
  widget: WidgetConfig;
  index: number;
  isEditing: boolean;
  onMove: (dragId: string, hoverId: string) => void;
  children: React.ReactNode;
}

// Size classes for the grid
const sizeClasses: Record<WidgetSize, string> = {
  small: "col-span-1",
  medium: "col-span-1",
  large: "lg:col-span-2",
};

export function DraggableWidget({
  widget,
  index,
  isEditing,
  onMove,
  children,
}: DraggableWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Simple drag and drop using native HTML5 API
  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.dataTransfer.setData("text/plain", widget.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    const dragId = e.dataTransfer.getData("text/plain");
    if (dragId && dragId !== widget.id) {
      onMove(dragId, widget.id);
    }
  };

  return (
    <div
      ref={ref}
      draggable={isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        sizeClasses[widget.size],
        "transition-all duration-200",
        isEditing && "cursor-grab active:cursor-grabbing ring-2 ring-primary/20 ring-offset-2 rounded-xl"
      )}
    >
      {children}
    </div>
  );
}
