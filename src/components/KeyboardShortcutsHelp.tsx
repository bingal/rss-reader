import { cn } from "@/lib/utils";
import { Icon } from "@iconify-icon/react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  action: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ["j", "↓"], action: "Next article" },
  { keys: ["k", "↑"], action: "Previous article" },
  { keys: ["o", "Enter"], action: "Open in browser" },
  { keys: ["r"], action: "Refresh feeds" },
  { keys: ["m"], action: "Toggle theme" },
  { keys: ["s"], action: "Toggle star" },
  { keys: ["?"], action: "Show shortcuts" },
];

export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.action}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    <kbd
                      className={cn(
                        "rounded border border-border bg-muted px-2 py-1 text-xs font-medium",
                        key.length > 1 && "min-w-[2rem] text-center",
                      )}
                    >
                      {key}
                    </kbd>
                    {index < shortcut.keys.length - 1 && (
                      <span className="text-muted-foreground">/</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5">
            ?
          </kbd>{" "}
          to toggle this dialog
        </p>
      </div>
    </div>
  );
}
