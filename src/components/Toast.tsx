import { useEffect } from "react";
import { Icon } from "@iconify-icon/react";

interface ToastProps {
  message: string;
  subMessage?: string;
  type?: "success" | "info" | "error";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  subMessage,
  type = "info",
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const iconMap = {
    success: "mdi:check-circle",
    info: "mdi:information",
    error: "mdi:alert-circle",
  };

  const colorMap = {
    success: "text-green-500",
    info: "text-blue-500",
    error: "text-destructive",
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background border border-border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 min-w-[280px]">
        <Icon
          icon={iconMap[type]}
          className={`text-xl ${colorMap[type]} mt-0.5`}
        />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          {subMessage && (
            <p className="text-xs text-muted-foreground mt-0.5">{subMessage}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon icon="mdi:close" className="text-sm" />
        </button>
      </div>
    </div>
  );
}
