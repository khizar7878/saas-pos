import { useState, useCallback, useEffect } from 'react';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetType = 'sales_today' | 'cash_sales' | 'card_sales' | 'ibft_sales' | 'products' | 'recent_sales' | 'quick_actions' | 'low_stock' | 'cash_in_hand' | 'weekly_sales' | 'top_products' | 'top_categories';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  position: number;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'sales_today', type: 'sales_today', size: 'small', position: 0, visible: true },
  { id: 'cash_sales', type: 'cash_sales', size: 'small', position: 1, visible: true },
  { id: 'card_sales', type: 'card_sales', size: 'small', position: 2, visible: true },
  { id: 'ibft_sales', type: 'ibft_sales', size: 'small', position: 3, visible: true },
  { id: 'weekly_sales', type: 'weekly_sales', size: 'medium', position: 4, visible: true }, // Chart
  { id: 'top_products', type: 'top_products', size: 'medium', position: 5, visible: true }, // Chart
  { id: 'top_categories', type: 'top_categories', size: 'small', position: 6, visible: true }, // Chart
  { id: 'recent_sales', type: 'recent_sales', size: 'large', position: 7, visible: true },
  { id: 'quick_actions', type: 'quick_actions', size: 'medium', position: 8, visible: true },
  { id: 'low_stock', type: 'low_stock', size: 'medium', position: 9, visible: true },
  { id: 'cash_in_hand', type: 'cash_in_hand', size: 'small', position: 10, visible: false },
  // Removed total_revenue (This Month) and customers (Credit Pending)
];

const STORAGE_KEY = 'dashboard_layout_v3';

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDGETS;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_WIDGETS;
      }
    }
    return DEFAULT_WIDGETS;
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const moveWidget = useCallback((dragId: string, hoverId: string) => {
    setWidgets((prev) => {
      const updated = [...prev].sort((a, b) => a.position - b.position);
      const dragIndex = updated.findIndex((w) => w.id === dragId);
      const hoverIndex = updated.findIndex((w) => w.id === hoverId);

      if (dragIndex === -1 || hoverIndex === -1) return prev;

      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);

      return updated.map((w, i) => ({ ...w, position: i }));
    });
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }, []);

  const changeWidgetSize = useCallback((id: string, size: WidgetSize) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const visibleWidgets = widgets.filter((w) => w.visible).sort((a, b) => a.position - b.position);

  return {
    widgets,
    visibleWidgets,
    isEditing,
    setIsEditing,
    moveWidget,
    toggleWidget,
    changeWidgetSize,
    resetLayout,
  };
}
