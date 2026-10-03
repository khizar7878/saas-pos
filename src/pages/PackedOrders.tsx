import React, { useState, useMemo, useRef } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { useShopPackedOrderItems } from "@/hooks/useWarehouseOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, AlertTriangle, ChevronRight, Layers, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const gradeBadgeColors: Record<string, string> = {
  "A": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "B": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "fresh_cut": "bg-primary/10 text-primary border-primary/20",
  "cut_piece": "bg-destructive/10 text-destructive border-destructive/20",
  "mill_cut_piece": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "unsettled": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "rags": "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

const gradeDisplayNames: Record<string, string> = {
  "A": "Grade A",
  "B": "Grade B",
  "fresh_cut": "Fresh Cut Pieces",
  "cut_piece": "Cut Pieces",
  "mill_cut_piece": "Mill Cut Pieces",
  "unsettled": "Unsettled",
  "rags": "Rags"
};

const formatPackedDateHeader = (dateKey: string) => {
  if (!dateKey || dateKey === "unknown") return "Unknown Date";
  const dateObj = parseISO(dateKey);
  if (isNaN(dateObj.getTime())) return dateKey;
  if (isToday(dateObj)) {
    return `Today — ${format(dateObj, "EEEE, MMMM d, yyyy")}`;
  }
  if (isYesterday(dateObj)) {
    return `Yesterday — ${format(dateObj, "EEEE, MMMM d, yyyy")}`;
  }
  return format(dateObj, "EEEE, MMMM d, yyyy");
};

interface GroupedShopPackedItem {
  groupKey: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  sku: string;
  notes?: string;
  totalMeters: number;
  totalPcs: number;
  splits: any[];
  distinctLots: string[];
  distinctLocations: string[];
  distinctGrades: string[];
}

export default function PackedOrders() {
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const shopLocationId = storeSettings?.location_id;

  const { data: packedItems = [], isLoading } = useShopPackedOrderItems(shopLocationId);

  const getMetersVariationStr = (item: any) => {
    if (!item.rolls_count || item.rolls_count <= 0) return "";
    const metersPerRoll = Number(item.quantity_meters) / item.rolls_count;
    if (isNaN(metersPerRoll) || metersPerRoll <= 0) return "";
    const strVal = metersPerRoll % 1 === 0 ? metersPerRoll.toFixed(0) : metersPerRoll.toFixed(1);
    return `${strVal}M`;
  };

  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const splitsRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const toggleExpandGroup = (groupKey: string) => {
    const isOpening = expandedGroupKey !== groupKey;
    setExpandedGroupKey(isOpening ? groupKey : null);

    if (isOpening) {
      setTimeout(() => {
        const el = splitsRowRefs.current[groupKey];
        if (el) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "end"
          });
        }
      }, 120);
    }
  };

  const groupedItems = useMemo(() => {
    const map = new Map<string, GroupedShopPackedItem>();

    packedItems.forEach(item => {
      const originItemId = item.parent_item_id || item.id;
      const groupKey = originItemId;
      const isCustom = !!item.custom_product_id;

      const displayName = isCustom 
        ? `${item.custom_product?.rebranded_name} (${item.custom_product?.base_product?.name})`
        : `${item.base_product?.name || "Unknown Product"}`;
      const displaySku = isCustom
        ? item.custom_product?.custom_sku
        : item.base_product?.sku || "-";
      const itemNotes = item.packing_details || "";

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          orderNumber: item.order?.order_number || "-",
          customerName: item.order?.customer?.name || "Retail Shop # 1",
          productName: displayName,
          sku: displaySku,
          notes: itemNotes,
          totalMeters: 0,
          totalPcs: 0,
          splits: [],
          distinctLots: [],
          distinctLocations: [],
          distinctGrades: []
        });
      }

      const group = map.get(groupKey)!;
      group.splits.push(item);
      group.totalMeters += Number(item.quantity_meters || 0);
      group.totalPcs += Number(item.rolls_count || 0);

      if (item.processed_lot?.lot_number && !group.distinctLots.includes(item.processed_lot.lot_number)) {
        group.distinctLots.push(item.processed_lot.lot_number);
      }
      if (item.packed_location?.name && !group.distinctLocations.includes(item.packed_location.name)) {
        group.distinctLocations.push(item.packed_location.name);
      }
      if (item.selected_grade && !group.distinctGrades.includes(item.selected_grade)) {
        group.distinctGrades.push(item.selected_grade);
      }
    });

    return Array.from(map.values());
  }, [packedItems]);

  // Group packed items by date (descending order)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      dateLabel: string;
      latestTimestamp: number;
      groups: GroupedShopPackedItem[];
      totalMeters: number;
      totalPcs: number;
    }>();

    groupedItems.forEach(group => {
      const firstSplit = group.splits[0];
      const rawTs = firstSplit?.processed_at || firstSplit?.created_at || firstSplit?.order?.created_at;
      const d = rawTs ? new Date(rawTs) : new Date();
      const dateKey = !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd") : "unknown";
      const ts = !isNaN(d.getTime()) ? d.getTime() : 0;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          dateLabel: formatPackedDateHeader(dateKey),
          latestTimestamp: ts,
          groups: [],
          totalMeters: 0,
          totalPcs: 0,
        });
      }

      const dg = map.get(dateKey)!;
      dg.groups.push(group);
      dg.totalMeters += group.totalMeters;
      dg.totalPcs += group.totalPcs;
      if (ts > dg.latestTimestamp) {
        dg.latestTimestamp = ts;
      }
    });

    const result = Array.from(map.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);

    result.forEach(dg => {
      dg.groups.sort((a, b) => {
        const tsA = new Date(a.splits[0]?.processed_at || a.splits[0]?.created_at || a.splits[0]?.order?.created_at || 0).getTime();
        const tsB = new Date(b.splits[0]?.processed_at || b.splits[0]?.created_at || b.splits[0]?.order?.created_at || 0).getTime();
        return tsB - tsA;
      });
    });

    return result;
  }, [groupedItems]);

  if (isLoadingSettings) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground mt-2">Loading store settings...</span>
      </div>
    );
  }

  if (!shopLocationId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-4 bg-warning/10 rounded-full mb-4">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Location Resolving Required</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          The location "Retail Shop # 1" could not be resolved from Supabase locations table.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Packed Orders</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            View orders that are packed at the warehouse and ready for dispatch to Retail Shop # 1.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <Card className="rounded-xl border border-border bg-card shadow-card hover:shadow-card-md transition-all duration-200 overflow-hidden flex flex-col h-full">
          <CardContent className="p-0 flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : groupedItems.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground my-auto flex flex-col items-center justify-center h-full">
                <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold">No packed orders in pool</p>
                <p className="text-xs opacity-75 mt-0.5">Packed orders appear here once they are processed and packed at the warehouse.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block flex-1 overflow-y-auto min-h-0 shadow-inner bg-muted/5 pb-16">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.05)] border-b border-border">
                      <TableRow>
                        <TableHead className="w-10 pl-4"></TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Order Details</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Product Details</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Allocation</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Grade</TableHead>
                        <TableHead className="text-xs font-bold text-right pr-6 text-muted-foreground">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByDate.map((dateGroup) => (
                        <React.Fragment key={dateGroup.dateKey}>
                          {/* Date Group Header Row */}
                          <TableRow className="bg-muted/70 hover:bg-muted/70 border-y border-border">
                            <TableCell colSpan={6} className="py-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-primary" />
                                  <span className="font-bold text-xs text-foreground uppercase tracking-wide">
                                    {dateGroup.dateLabel}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-semibold bg-background border-border">
                                    {dateGroup.groups.length} {dateGroup.groups.length === 1 ? 'item' : 'items'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <span className="text-muted-foreground">Pcs: <strong className="text-foreground">{dateGroup.totalPcs}</strong></span>
                                  <span>Meters: <strong className="text-primary font-bold">{dateGroup.totalMeters.toLocaleString()} m</strong></span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>

                          {dateGroup.groups.map((group) => {
                            const hasSplits = group.splits.length > 1;
                            const isExpanded = hasSplits && expandedGroupKey === group.groupKey;
                            const singleItem = group.splits[0];
                            const singleVarStr = !hasSplits ? getMetersVariationStr(singleItem) : "";

                            return (
                              <div key={group.groupKey} className="contents">
                            <TableRow 
                              className={cn("hover:bg-muted/15 transition-colors border-b border-border/50", isExpanded && "bg-muted/20")}
                            >
                              <TableCell className="pl-4 pr-0 w-10">
                                {hasSplits ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-7 w-7 text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-md transition-all duration-200",
                                      isExpanded && "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                    onClick={() => toggleExpandGroup(group.groupKey)}
                                    title={isExpanded ? "Collapse splits" : "Expand split details"}
                                  >
                                    <ChevronRight 
                                      className={cn(
                                        "w-4 h-4 transition-transform duration-200 ease-in-out",
                                        isExpanded && "rotate-90"
                                      )} 
                                    />
                                  </Button>
                                ) : (
                                  <div className="w-7 h-7" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-bold text-foreground text-xs font-mono">{group.orderNumber}</div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground text-xs">
                                    {!hasSplits && singleVarStr 
                                      ? `${group.productName} - ${singleVarStr}` 
                                      : group.productName}
                                  </span>
                                  {hasSplits && (
                                    <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
                                      {group.splits.length} Splits
                                    </Badge>
                                  )}
                                </div>
                                {group.notes ? (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px] truncate font-normal" title={group.notes}>
                                    {group.notes}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground/50 italic mt-0.5">No notes</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-foreground text-xs font-mono">
                                  {group.distinctLots.length === 1 ? `Lot: ${group.distinctLots[0]}` : `Lots: ${group.distinctLocations.join(", ")}`}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                  Loc: {group.distinctLocations.join(", ") || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {group.distinctGrades.map(g => (
                                    <Badge key={g} variant="outline" className={cn(
                                      "text-[8px] font-bold py-0 h-5 px-2",
                                      gradeBadgeColors[g] || "bg-muted text-muted-foreground"
                                    )}>
                                      {gradeDisplayNames[g] || g}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="font-semibold text-foreground text-xs font-mono">{group.totalPcs} pcs</div>
                                <div className="text-[10px] font-bold text-primary font-mono mt-0.5">{group.totalMeters} m</div>
                              </TableCell>
                            </TableRow>

                            {hasSplits && (
                              <TableRow 
                                ref={el => { splitsRowRefs.current[group.groupKey] = el; }}
                                className="p-0 border-none hover:bg-transparent"
                              >
                                <TableCell colSpan={6} className="p-0 border-none">
                                  <div 
                                    className={cn(
                                      "grid transition-[grid-template-rows,opacity] duration-250 ease-in-out",
                                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                    )}
                                  >
                                    <div className="overflow-hidden">
                                      <Table className="w-full text-left">
                                        <TableBody>
                                          {group.splits.map((splitItem, idx) => {
                                            const splitVarStr = getMetersVariationStr(splitItem);
                                            const splitDisplayName = splitVarStr 
                                              ? `${group.productName} - ${splitVarStr}` 
                                              : group.productName;

                                            return (
                                              <TableRow 
                                                key={splitItem.id} 
                                                className="bg-muted/10 hover:bg-muted/20 border-b border-border/40 transition-colors"
                                              >
                                                <TableCell className="pl-4 pr-0 text-center text-muted-foreground font-mono text-[10px] font-semibold w-10">
                                                  #{idx + 1}
                                                </TableCell>

                                                <TableCell>
                                                   <div className="font-bold text-foreground text-xs font-mono">{group.orderNumber}</div>
                                                 </TableCell>

                                                 <TableCell>
                                                   <div className="font-semibold text-foreground text-xs">
                                                     {splitDisplayName}
                                                   </div>
                                                   {group.notes ? (
                                                     <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate font-normal" title={group.notes}>
                                                       {group.notes}
                                                     </div>
                                                   ) : (
                                                     <div className="text-[10px] text-muted-foreground/50 italic mt-0.5">No notes</div>
                                                   )}
                                                 </TableCell>

                                                <TableCell>
                                                  <div className="font-semibold text-foreground text-xs font-mono">
                                                    Lot: {splitItem.processed_lot?.lot_number || "-"}
                                                  </div>
                                                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                                    Loc: {splitItem.packed_location?.name || "-"}
                                                  </div>
                                                </TableCell>

                                                <TableCell>
                                                  <Badge variant="outline" className={cn(
                                                    "text-[8px] font-bold py-0 h-5 px-2",
                                                    gradeBadgeColors[splitItem.selected_grade] || "bg-muted text-muted-foreground"
                                                  )}>
                                                    {gradeDisplayNames[splitItem.selected_grade] || splitItem.selected_grade}
                                                  </Badge>
                                                </TableCell>

                                                <TableCell className="text-right pr-6">
                                                  <div className="font-semibold text-foreground text-xs font-mono">{splitItem.rolls_count} pcs</div>
                                                  <div className="text-[10px] font-bold text-primary font-mono mt-0.5">{splitItem.quantity_meters} m</div>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

          <div className="md:hidden space-y-4">
            {groupedByDate.map((dateGroup) => (
              <div key={dateGroup.dateKey} className="space-y-2">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/70 border-y border-border text-xs font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold uppercase tracking-wide">{dateGroup.dateLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{dateGroup.totalPcs} pcs</span>
                    <span className="text-primary font-bold">{dateGroup.totalMeters.toLocaleString()} m</span>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {dateGroup.groups.map((group) => {
                    const hasSplits = group.splits.length > 1;
                    const isExpanded = hasSplits && expandedGroupKey === group.groupKey;
                    const singleItem = group.splits[0];
                    const singleVarStr = !hasSplits ? getMetersVariationStr(singleItem) : "";

                    return (
                      <div key={group.groupKey} className="p-4 space-y-2">
                        <div className="font-bold text-xs text-foreground font-mono">{group.orderNumber}</div>
                        
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span>
                              {!hasSplits && singleVarStr 
                                ? `${group.productName} - ${singleVarStr}` 
                                : group.productName}
                            </span>
                            {hasSplits && (
                              <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 px-1.5 bg-primary/10 text-primary">
                                {group.splits.length} Splits
                              </Badge>
                            )}
                          </div>
                          {group.notes ? (
                            <div className="text-[11px] text-muted-foreground font-normal">{group.notes}</div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground/50 italic">No notes</div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/40 font-semibold">
                          <div>PCS: <span className="font-bold text-foreground font-mono">{group.totalPcs} pcs</span></div>
                          <div>Meters: <span className="font-bold text-primary font-mono">{group.totalMeters} m</span></div>
                        </div>

                        {hasSplits && (
                          <div className="pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary font-semibold p-0 flex items-center"
                              onClick={() => toggleExpandGroup(group.groupKey)}
                            >
                              <ChevronRight className={cn("w-3.5 h-3.5 mr-1 transition-transform duration-200", isExpanded && "rotate-90")} />
                              {isExpanded ? "Hide Splits" : `View ${group.splits.length} Splits`}
                            </Button>
                          </div>
                        )}

                        {hasSplits && (
                          <div 
                            className={cn(
                              "grid transition-[grid-template-rows,opacity] duration-250 ease-in-out",
                              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="pt-2 space-y-2 border-t border-border/40 bg-muted/20 p-2 rounded-lg mt-2">
                                {group.splits.map((splitItem, idx) => {
                                  const splitVarStr = getMetersVariationStr(splitItem);
                                  const splitName = splitVarStr ? `${group.productName} - ${splitVarStr}` : group.productName;

                                  return (
                                    <div key={splitItem.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-none">
                                      <div className="space-y-0.5">
                                        <div className="font-bold text-foreground text-[11px]">
                                          #{idx + 1} {splitName}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          Lot: {splitItem.processed_lot?.lot_number || "-"} • Loc: {splitItem.packed_location?.name || "-"}
                                        </div>
                                      </div>
                                      <div className="text-right font-mono font-bold text-foreground">
                                        {splitItem.rolls_count} pcs ({splitItem.quantity_meters} m)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
