import React, { useState } from 'react';
import { useIntercomCall, IntercomUser } from '@/hooks/useIntercomCall';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Radio, 
  Store, 
  ShoppingBag,
  Warehouse, 
  Volume2,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function IntercomCallWidget({
  collapsed = false,
  isMobileHeader = false,
}: {
  collapsed?: boolean;
  isMobileHeader?: boolean;
}) {
  const {
    myClientId,
    displayName,
    onlineUsers,
    callStatus,
    activeCall,
    isMuted,
    callDuration,
    micPermissionState,
    requestMicPermission,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  } = useIntercomCall();

  const [popoverOpen, setPopoverOpen] = useState(false);

  const warehouseUsers = onlineUsers.filter(u => u.app === 'ak-warehouse');
  const wholesaleUsers = onlineUsers.filter(u => u.app === 'akws');
  const retailUsers = onlineUsers.filter(u => u.app === 'ak-retail-pos');

  const buttonElement = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPopoverOpen((prev) => !prev);
      }}
      className={cn(
        isMobileHeader
          ? "relative rounded-lg p-2 hover:bg-muted transition-all duration-200 active:scale-95 flex items-center justify-center"
          : cn(
              "relative flex items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all active:scale-95",
              collapsed ? "w-10 h-10" : "flex-1 h-10"
            ),
        callStatus !== 'idle' && "bg-emerald-500/20 text-emerald-600 animate-pulse"
      )}
    >
      <Phone
        className={cn(
          "w-5 h-5 transition-transform",
          callStatus !== 'idle'
            ? "text-emerald-500 animate-bounce"
            : isMobileHeader
            ? "text-muted-foreground hover:text-emerald-500"
            : "text-sidebar-muted hover:text-emerald-500"
        )}
      />
      {onlineUsers.length > 0 && (
        <>
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 text-[9px] font-extrabold text-white rounded-full flex items-center justify-center shadow-sm">
            {onlineUsers.length}
          </span>
        </>
      )}
    </button>
  );

  return (
    <>
      {/* Active Call Floating Overlay */}
      {callStatus !== 'idle' && activeCall && (
        <div className="fixed bottom-6 right-6 z-[99999] animate-fade-in">
          <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 border border-slate-700/60 shadow-2xl rounded-2xl p-4 w-80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  {callStatus === 'outgoing_ringing' && 'Calling...'}
                  {callStatus === 'incoming_ringing' && 'Incoming Call'}
                  {callStatus === 'connected' && `In Call (${formatDuration(callDuration)})`}
                </span>
              </div>
              {callStatus === 'connected' && (
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  Live
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                {activeCall.peerName.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-100 truncate">{activeCall.peerName}</h4>
                <p className="text-xs text-slate-400 truncate">
                  {activeCall.peerApp === 'ak-warehouse' ? 'Central Warehouse' : activeCall.peerApp === 'ak-retail-pos' ? 'Retail Shop # 1' : 'Wholesale Shop'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              {callStatus === 'incoming_ringing' && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={declineCall}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium h-9 gap-1.5"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={acceptCall}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-9 gap-1.5"
                  >
                    <Phone className="w-4 h-4" />
                    Accept
                  </Button>
                </>
              )}

              {callStatus === 'outgoing_ringing' && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={endCall}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium h-9 gap-1.5"
                >
                  <PhoneOff className="w-4 h-4" />
                  Cancel Call
                </Button>
              )}

              {callStatus === 'connected' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleMute}
                    className={cn(
                      "h-9 px-3 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700",
                      isMuted && "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                    )}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={endCall}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium h-9 gap-1.5"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Call
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        {isMobileHeader ? (
          <PopoverTrigger asChild>
            {buttonElement}
          </PopoverTrigger>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                {buttonElement}
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>
              <p>Intercom ({onlineUsers.length} Online)</p>
            </TooltipContent>
          </Tooltip>
        )}

        <PopoverContent 
          className="w-80 p-0 border border-border/60 shadow-xl glassmorphism-card overflow-hidden z-[9999]" 
          side={isMobileHeader ? "bottom" : (collapsed ? "right" : "top")} 
          align={isMobileHeader ? "end" : "start"}
        >
          {/* Header */}
          <div className="p-3 bg-muted/40 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Intercom Stations
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 font-medium">
              {onlineUsers.length} Online
            </Badge>
          </div>

          {/* Mic Permission Banner */}
          {micPermissionState !== 'granted' && (
            <div className="p-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                <MicOff className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span className="text-[11px] leading-tight">
                  {micPermissionState === 'denied'
                    ? 'Mic blocked in browser settings.'
                    : 'Enable mic for clear voice calls.'}
                </span>
              </div>
              {micPermissionState !== 'denied' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestMicPermission()}
                  className="h-6 px-2 text-[10px] bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 shrink-0 font-semibold"
                >
                  Enable Mic
                </Button>
              )}
            </div>
          )}

          {/* User Selection List */}
          <div className="p-2 max-h-72 overflow-y-auto space-y-3">
            {/* Wholesale Shop Terminals */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Store className="w-3 h-3 text-blue-500" />
                Wholesale Shop
              </div>
              {wholesaleUsers.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground italic">No Wholesale Shop terminals online</p>
              ) : (
                <div className="space-y-1 mt-1">
                  {wholesaleUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-2 rounded-lg bg-card/60 hover:bg-emerald-500/10 border border-border/30 hover:border-emerald-500/40 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 font-bold flex items-center justify-center text-xs">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground leading-none">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {u.locationName || 'Wholesale Shop Terminal'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={callStatus !== 'idle'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverOpen(false);
                          initiateCall(u);
                        }}
                        className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-sm"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Retail Shop Terminals */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-purple-500" />
                Retail Shop
              </div>
              {retailUsers.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground italic">No other Retail Shop terminals online</p>
              ) : (
                <div className="space-y-1 mt-1">
                  {retailUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-2 rounded-lg bg-card/60 hover:bg-emerald-500/10 border border-border/30 hover:border-emerald-500/40 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 font-bold flex items-center justify-center text-xs">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground leading-none">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {u.locationName || 'Retail Shop # 1'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={callStatus !== 'idle'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverOpen(false);
                          initiateCall(u);
                        }}
                        className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-sm"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Central Warehouse Terminals */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Warehouse className="w-3 h-3 text-amber-500" />
                Central Warehouse
              </div>
              {warehouseUsers.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground italic">No warehouse desks online</p>
              ) : (
                <div className="space-y-1 mt-1">
                  {warehouseUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-2 rounded-lg bg-card/60 hover:bg-emerald-500/10 border border-border/30 hover:border-emerald-500/40 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 font-bold flex items-center justify-center text-xs">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground leading-none">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {u.locationName || 'Warehouse Station'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={callStatus !== 'idle'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverOpen(false);
                          initiateCall(u);
                        }}
                        className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-sm"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-2 bg-muted/30 border-t border-border/40 text-center">
            <p className="text-[10px] text-muted-foreground">
              Intercom global broadcast network ready
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
