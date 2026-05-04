import { useState, useEffect } from "react";
import { History, RotateCcw, Clock, Info } from "lucide-react";
import { algoApi } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

interface StrategyHistoryProps {
  filename: string;
  onRestore: (content: string) => void;
  accentColorClass: string;
}

export function StrategyHistory({ filename, onRestore, accentColorClass }: StrategyHistoryProps) {
  const [versions, setVersions] = useState<{timestamp: string, content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await algoApi.getStrategyFileVersions(filename);
      setVersions(res.versions || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filename) fetchVersions();
  }, [filename]);

  const formatTimestamp = (ts: string) => {
    // format YYYYMMDDHHMMSS -> date string
    if (ts.length !== 14) return ts;
    const year = ts.slice(0, 4);
    const month = ts.slice(4, 6);
    const day = ts.slice(6, 8);
    const hr = ts.slice(8, 10);
    const min = ts.slice(10, 12);
    const sec = ts.slice(12, 14);
    return `${year}-${month}-${day} @ ${hr}:${min}:${sec}`;
  };

  return (
    <div className="w-64 border-l border-border bg-card/5 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-3 border-b border-border bg-card/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <History className={cn("w-3.5 h-3.5", accentColorClass)} />
           <span className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground">File_History</span>
        </div>
        <button onClick={fetchVersions} className="text-muted-foreground/40 hover:text-primary"><RotateCcw className={cn("w-3 h-3", loading && "animate-spin")} /></button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-2 space-y-2">
        {loading && <div className="text-[9px] font-mono text-muted-foreground/50 text-center py-4">LOADING_HISTORY...</div>}
        {!loading && error && <div className="text-[9px] font-mono text-destructive/80 text-center py-4">{error}</div>}
        {!loading && versions.length === 0 && <div className="text-[9px] font-mono text-muted-foreground/30 text-center py-4 uppercase">No Backups Found</div>}

        {!loading && versions.map((v, i) => (
          <div key={v.timestamp} className="p-2 border border-border/20 bg-background/40 hover:bg-white/5 transition-all group flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[8px] font-mono font-black text-muted-foreground/80 tracking-widest">{formatTimestamp(v.timestamp)}</span>
              </div>
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase">v-{versions.length - i}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[7px] font-mono font-bold text-muted-foreground/40">{v.content.length} BYTES</span>
              <button
                onClick={() => onRestore(v.content)}
                className="px-2 py-0.5 text-[7px] font-mono font-black uppercase bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black transition-colors"
                title="Restore this version"
              >
                RESTORE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
