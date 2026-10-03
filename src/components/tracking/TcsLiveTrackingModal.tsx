import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sparkles
} from "lucide-react";
import { fetchTcsTracking, TcsTrackingResult } from "@/services/tcsTrackingService";
import { toast } from "sonner";

interface TcsLiveTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consignmentNumber: string | null;
}

export default function TcsLiveTrackingModal({
  open,
  onOpenChange,
  consignmentNumber
}: TcsLiveTrackingModalProps) {
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<TcsTrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTracking = async () => {
    if (!consignmentNumber) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetchTcsTracking(consignmentNumber);
      setTrackingData(res);
    } catch (err: any) {
      console.error("TCS Tracking Error:", err);
      setError(err.message || "Failed to retrieve live tracking from TCS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && consignmentNumber) {
      loadTracking();
    } else if (!open) {
      setTrackingData(null);
      setError(null);
    }
  }, [open, consignmentNumber]);

  const copyCn = () => {
    if (!consignmentNumber) return;
    navigator.clipboard.writeText(consignmentNumber);
    setCopied(true);
    toast.success("Consignment Number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const shipment = trackingData?.shipmentinfo?.[0];
  const checkpoints = trackingData?.checkpoints || [];
  const latestCheckpoint = checkpoints[0];

  const getStatusBadge = (statusStr: string = "") => {
    const s = statusStr.toLowerCase();
    if (s.includes("deliver")) {
      return <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</Badge>;
    }
    if (s.includes("depart") || s.includes("transit") || s.includes("out for")) {
      return <Badge className="bg-primary text-primary-foreground gap-1"><Truck className="w-3 h-3 animate-pulse" /> In Transit</Badge>;
    }
    if (s.includes("arrive")) {
      return <Badge variant="outline" className="border-primary/40 text-primary gap-1"><MapPin className="w-3 h-3" /> Facility</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Package className="w-3 h-3" /> {statusStr || "Booked"}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md md:max-w-lg p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-primary/10 via-background to-teal-500/10 border-b border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-foreground tracking-wide flex items-center gap-1.5">
                  TCS Express Live Tracking <Sparkles className="w-4 h-4 text-primary" />
                </DialogTitle>
                <p className="text-xs text-muted-foreground">Real-time status directly from TCS Courier</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={loadTracking}
              disabled={loading}
              className="h-8 w-8 text-foreground hover:bg-muted"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Consignment Bar */}
          <div className="flex items-center justify-between bg-background p-2.5 rounded-xl border border-border/80 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-semibold">CN #:</span>
              <span className="font-mono font-black text-foreground text-sm tracking-widest">
                {consignmentNumber}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyCn}
              className="h-6 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1 px-2"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Fetching live tracking status from TCS Express...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">Unable to fetch status directly</p>
              <p className="text-xs text-muted-foreground px-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.tcsexpress.com/track/${consignmentNumber}`, '_blank')}
                className="gap-1.5 text-xs font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open TCS Official Tracking Page
              </Button>
            </div>
          ) : trackingData ? (
            <div className="space-y-4">
              {/* Route Summary */}
              {shipment && (
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Origin ➔ Destination</span>
                    {getStatusBadge(latestCheckpoint?.status)}
                  </div>
                  <div className="flex items-center justify-between font-bold text-sm text-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> {shipment.origin}
                    </span>
                    <span className="text-muted-foreground text-xs font-normal">➔</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {shipment.destination}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
                    <span>Booked: {shipment.bookingdate}</span>
                    <span>Consignee: {shipment.consignee}</span>
                  </div>
                </div>
              )}

              {/* Checkpoints Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Checkpoint History
                </h4>

                <ScrollArea className="max-h-[240px] pr-2">
                  {checkpoints.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No checkpoints recorded yet.</p>
                  ) : (
                    <div className="relative border-l-2 border-primary/20 ml-3 space-y-4 py-1">
                      {checkpoints.map((cp, idx) => (
                        <div key={idx} className="relative pl-6 space-y-0.5">
                          {/* Indicator Node */}
                          <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
                            idx === 0 ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted-foreground/30"
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? "bg-white" : "bg-muted"}`} />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs ${idx === 0 ? "font-bold text-primary" : "font-semibold text-foreground"}`}>
                              {cp.status}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                              {cp.datetime}
                            </span>
                          </div>

                          {cp.recievedby && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground/70" /> Facility: {cp.recievedby}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Summary Text Callout */}
              {trackingData.shipmentsummary && (
                <div className="text-[11px] text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/15 space-y-1">
                  <span className="font-bold text-primary block">TCS Remarks:</span>
                  <p className="whitespace-pre-line leading-relaxed">{trackingData.shipmentsummary}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://www.tcsexpress.com/track/${consignmentNumber}`, '_blank')}
              className="text-xs gap-1.5 font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" /> TCS Official Site
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
