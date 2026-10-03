import {
    Send,
    Pause,
    Trash2,
    Search,
    ScanBarcode,
    User,
    ShoppingBag,
    Clock,
    Printer,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutItemProps {
    shortcut: string;
    label: string;
    icon: React.ElementType;
    action?: () => void;
}

import { useHotkeys } from "react-hotkeys-hook";
import { useState } from "react";

// ...

const ShortcutItem = ({ shortcut, label, icon: Icon, action }: ShortcutItemProps) => {
    const [isActive, setIsActive] = useState(false);

    useHotkeys(shortcut, () => {
        setIsActive(true);
        setTimeout(() => setIsActive(false), 200);
    }, { enableOnFormTags: true });

    return (
        <button
            onClick={action}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card group",
                "hover:bg-primary hover:text-primary-foreground transition-colors",
                isActive && "bg-primary text-primary-foreground border-primary-foreground", // Blink effect
                "text-xs font-medium text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            title={`${label} (${shortcut})`}
        >
            <span className={cn(
                "bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border min-w-[24px] text-center font-mono transition-colors",
                "group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary-foreground",
                isActive && "bg-primary text-primary-foreground border-primary-foreground" // Blink effect
            )}>
                {shortcut}
            </span>
            <div className={cn(
                "flex items-center gap-1.5 group-hover:text-primary-foreground",
                isActive && "text-primary-foreground" // Blink effect
            )}>
                <Icon className="w-3.5 h-3.5" />
                {/* Text label removed as requested */}
            </div>
        </button>
    );
};

const ShortcutBar = ({ onAction }: { onAction: (key: string) => void }) => {
    const shortcuts = [
        { key: "F1", label: "Send", icon: Send },
        { key: "F2", label: "Hold", icon: Pause },
        { key: "F3", label: "Clear", icon: Trash2 },
        { key: "F4", label: "Search", icon: Search },
        { key: "F5", label: "Barcode", icon: ScanBarcode },
        { key: "F6", label: "Customer", icon: User },
        { key: "F8", label: "Auto Print", icon: Printer },
        { key: "F9", label: "Checkout", icon: ShoppingBag },
        { key: "F10", label: "Quote", icon: FileText },
    ];

    return (
        <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:pb-0 md:mx-0 md:px-0 no-scrollbar">
            {shortcuts.map((s) => (
                <ShortcutItem
                    key={s.key}
                    shortcut={s.key}
                    label={s.label}
                    icon={s.icon}
                    action={() => onAction(s.key)}
                />
            ))}
        </div>
    );
};

export default ShortcutBar;
