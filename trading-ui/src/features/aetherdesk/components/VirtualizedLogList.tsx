import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Zap, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { AetherPanel } from '@/components/ui/AetherPanel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPreparedText, PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS } from '@/lib/pretext';
import { layout } from '@chenglou/pretext';

interface LogEntry {
  id: number;
  api_type: string;
  request_data: any;
  response_data: any;
  strategy: string;
  created_at: string;
}

interface VirtualizedLogListProps {
  logs: LogEntry[];
  expandedLogs: Set<number>;
  onToggleExpand: (id: number) => void;
  isAD: boolean;
  primaryColorClass: string;
  accentBorderClass: string;
}

const HEADER_HEIGHT = 64; // Approximated height of the log header (p-4 + badges/text)
const PADDING_Y = 32; // Standard padding inside expanded areas
const GAP = 12; // space-y-3 = 12px

export const VirtualizedLogList: React.FC<VirtualizedLogListProps> = ({
  logs,
  expandedLogs,
  onToggleExpand,
  isAD,
  primaryColorClass,
  accentBorderClass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Resize Observer to handle responsive layout width changes
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Pre-calculate heights for all logs using Pretext
  const items = useMemo(() => {
    if (containerWidth === 0) return [];

    let currentOffset = 0;
    const textWidth = Math.max(containerWidth - 40, 100); // 40px estimated horizontal padding in logs

    return logs.map((log) => {
      const isExpanded = expandedLogs.has(log.id);
      let contentHeight = 0;

      if (isExpanded) {
        // Measure Request Data JSON
        const reqJson = JSON.stringify(log.request_data, null, 2);
        const reqPrepared = getPreparedText(reqJson, PRETEXT_FONTS.LOGS);
        const reqLayout = layout(reqPrepared, textWidth / 2 - 40, PRETEXT_LINE_HEIGHTS.LOGS);

        // Measure Response Data JSON
        const resJson = JSON.stringify(log.response_data, null, 2);
        const resPrepared = getPreparedText(resJson, PRETEXT_FONTS.LOGS);
        const resLayout = layout(resPrepared, textWidth / 2 - 40, PRETEXT_LINE_HEIGHTS.LOGS);

        // Max of two side-by-side columns + padding
        contentHeight = Math.max(reqLayout.height, resLayout.height) + PADDING_Y + 40; // 40 for labels/margins
      }

      const totalItemHeight = HEADER_HEIGHT + contentHeight;
      const item = {
        log,
        height: totalItemHeight,
        offset: currentOffset,
      };

      currentOffset += totalItemHeight + GAP;
      return item;
    });
  }, [logs, expandedLogs, containerWidth]);

  const totalHeight = items.length > 0 ? items[items.length - 1].offset + items[items.length - 1].height : 0;

  // Find visible range
  const visibleItems = useMemo(() => {
    const start = scrollTop;
    const end = scrollTop + containerHeight;

    // Overscan to avoid flickering
    const overscan = 200;

    return items.filter(
      (item) => item.offset + item.height >= start - overscan && item.offset <= end + overscan
    );
  }, [items, scrollTop, containerHeight]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
        <div className={cn("p-4 border rounded-full", accentBorderClass)}>
          <Terminal className={cn("w-10 h-10", primaryColorClass)} />
        </div>
        <div className="text-[11px] font-mono font-black uppercase tracking-[0.4em]">NO_TELEMETRY_INTERCEPTED</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto custom-scrollbar relative"
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleItems.map(({ log, offset }) => (
          <div
            key={log.id}
            style={{
              position: 'absolute',
              top: offset,
              left: 0,
              width: '100%',
            }}
          >
            <AetherPanel className={cn(
              "border-border/10 bg-background/20 hover:bg-background/40 transition-all p-0 overflow-hidden group",
              expandedLogs.has(log.id) && accentBorderClass
            )}>
              <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => onToggleExpand(log.id)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-1 h-8 rounded-full opacity-20", primaryColorClass, "bg-current")} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border-border/20", primaryColorClass)}>{log.api_type}</Badge>
                      <div className="text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-2">
                        <Zap className={cn("w-3 h-3 opacity-40", primaryColorClass)} />
                        {log.strategy || 'DEFAULT_CORE'}
                      </div>
                    </div>
                    <div className="text-[8px] font-mono text-muted-foreground/40 mt-1 italic">{log.created_at}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(log.request_data).slice(0, 4).map(([key, val]) => (
                      <div key={key} className="flex gap-2 items-baseline">
                        <span className="text-[7px] text-muted-foreground/30 uppercase font-black">{key}:</span>
                        <span className="text-[9px] font-mono font-bold truncate max-w-[80px] opacity-70">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-1 border border-border/10">
                    {expandedLogs.has(log.id) ? <ChevronUp className="w-3.5 h-3.5 opacity-30" /> : <ChevronDown className="w-3.5 h-3.5 opacity-30" />}
                  </div>
                </div>
              </div>

              {expandedLogs.has(log.id) && (
                <div className="grid grid-cols-1 md:grid-cols-2 border-t border-border/10 bg-foreground/5 animate-in slide-in-from-top-4 duration-300">
                  <div className="p-4 border-r border-border/10">
                    <div className="micro-label text-muted-foreground/40 italic flex items-center gap-2 mb-3">
                      <Terminal className="w-3 h-3" /> REQUEST_PAYLOAD
                    </div>
                    <pre className={cn("text-[9px] font-mono bg-background/40 p-3 border border-border/10 custom-scrollbar max-h-[400px] overflow-auto", isAD ? "text-primary/70" : "text-teal-500/70")}>
                      {JSON.stringify(log.request_data, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4">
                    <div className="micro-label text-muted-foreground/40 italic flex items-center gap-2 mb-3">
                      <Zap className="w-3 h-3" /> KERNEL_RESPONSE
                    </div>
                    <pre className={cn("text-[9px] font-mono bg-background/40 p-3 border border-border/10 custom-scrollbar max-h-[400px] overflow-auto", isAD ? "text-amber-400/70" : "text-emerald-400/70")}>
                      {JSON.stringify(log.response_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </AetherPanel>
          </div>
        ))}
      </div>
    </div>
  );
};
