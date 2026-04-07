import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { motion } from "framer-motion";

interface ApiErrorBoundaryProps {
  error: string | null;
  onRetry: () => void;
  label: string;
  compact?: boolean;
}

export function ApiErrorBoundary({ error, onRetry, label, compact = false }: ApiErrorBoundaryProps) {
  if (!error) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <WifiOff className="w-4 h-4 text-destructive shrink-0" />
        <span className="text-xs text-destructive flex-1">{error}</span>
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive text-[10px] font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{label} Unreachable</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors border border-primary/20"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
        <p className="text-[10px] text-muted-foreground">
          The backend API may be offline. Start the Docker stack or check <code className="text-primary/70">docker compose ps</code>.
        </p>
      </div>
    </motion.div>
  );
}
