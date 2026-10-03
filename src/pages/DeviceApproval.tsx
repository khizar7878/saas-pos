import { ShieldAlert, RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceSecurity } from "@/hooks/useDeviceSecurity";

const DeviceApproval = () => {
    const { signOut, user } = useAuth();
    const { deviceIdentifier, deviceName, status } = useDeviceSecurity();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
            <div className="w-full max-w-md bg-card border border-border shadow-card rounded-xl p-8 text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-warning" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Device Approval Required</h1>
                    <p className="text-muted-foreground">
                        To ensure security, this device needs to be approved by an administrator before you can access the system.
                    </p>
                </div>

                <div className="bg-muted rounded-lg p-4 text-sm space-y-2 border border-border">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">User:</span>
                        <span className="font-medium">{user?.email}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Device:</span>
                        <span className="font-medium">{deviceName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">ID:</span>
                        <span className="font-mono text-xs">{deviceIdentifier.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-medium text-warning capitalize">{status}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Button
                        className="w-full"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Approval Status
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground"
                        onClick={() => signOut()}
                    >
                        Sign Out
                    </Button>
                </div>

                <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <KeyRound className="w-4 h-4" />
                        <span>Security Tip</span>
                    </div>
                    <p>
                        Contact an admin to approve this request in <strong>Setup &gt; Security</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DeviceApproval;
