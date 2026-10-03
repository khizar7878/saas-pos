import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, UserCheck } from "lucide-react";
import { useUsers, UserProfile } from "@/hooks/useUsers";
import { Loader2 } from "lucide-react";

interface UserSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectUser: (userId: string) => void;
    isProcessing: boolean;
    salesOnly?: boolean;
}

const UserSelectionDialog = ({
    open,
    onOpenChange,
    onSelectUser,
    isProcessing,
    salesOnly = false,
}: UserSelectionDialogProps) => {
    const { data: users = [], isLoading } = useUsers(salesOnly);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Forward Order To</DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <ScrollArea className="h-[300px] pr-4">
                        <div className="flex flex-col gap-2">
                            {users.map((user) => (
                                <Button
                                    key={user.id}
                                    variant="outline"
                                    className="justify-between h-auto py-3 px-4"
                                    onClick={() => onSelectUser(user.id)}
                                    disabled={isProcessing}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium leading-none">{user.full_name || user.email}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{user.is_admin ? "Admin" : "Staff"}</p>
                                        </div>
                                    </div>
                                    {isProcessing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                                </Button>
                            ))}
                            {users.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    No active users found.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default UserSelectionDialog;
