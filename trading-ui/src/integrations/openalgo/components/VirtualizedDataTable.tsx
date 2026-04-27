import React, { useRef, useMemo } from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';

export interface ColumnDefinition<T> {
  key: string;
  header: React.ReactNode;
  width: number | string;
  cell: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  rowHeight?: number;
  headerHeight?: number;
  className?: string;
  containerClassName?: string;
  onRowClick?: (item: T) => void;
  rowClassName?: string | ((item: T, index: number) => string);
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  onScroll?: (props: { scrollOffset: number }) => void;
  overscanCount?: number;
  renderExpandedRow?: (item: T, index: number) => React.ReactNode;
  isRowExpanded?: (item: T, index: number) => boolean;
  expandedRowHeight?: number | ((item: T, index: number) => number);
}

export function VirtualizedDataTable<T>({
  data,
  columns,
  rowHeight = 44,
  headerHeight = 40,
  className = "",
  containerClassName = "",
  onRowClick,
  rowClassName,
  keyExtractor,
  emptyMessage = "NO_DATA_INTERCEPTED",
  onScroll,
  overscanCount = 10,
  renderExpandedRow,
  isRowExpanded,
  expandedRowHeight = 200,
}: VirtualizedDataTableProps<T>) {
  const listRef = useRef<ListImperativeAPI>(null);
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';

  const columnWidths = useMemo(() => {
    return columns.map(col => {
      if (typeof col.width === 'number') return col.width;
      return 150;
    });
  }, [columns]);

  const getItemSize = (index: number) => {
    const item = data[index];
    const baseHeight = rowHeight;
    if (isRowExpanded && isRowExpanded(item, index)) {
      const extraHeight = typeof expandedRowHeight === 'function'
        ? expandedRowHeight(item, index)
        : expandedRowHeight;
      return baseHeight + extraHeight;
    }
    return baseHeight;
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = data[index];
    const itemKey = keyExtractor ? keyExtractor(item, index) : (item as any).orderid || (item as any).id || (item as any).symbol || index;

    const customRowClass = typeof rowClassName === 'function' ? rowClassName(item, index) : rowClassName;
    const expanded = isRowExpanded ? isRowExpanded(item, index) : false;

    return (
      <div style={style} className="overflow-hidden">
        <div
            className={cn(
            "flex items-center border-b border-border/10 hover:bg-foreground/[0.02] transition-colors group/row cursor-default bg-background/5",
            expanded && "border-b-0",
            customRowClass
            )}
            style={{ height: rowHeight }}
            onClick={() => onRowClick?.(item)}
        >
            {columns.map((col, colIdx) => (
            <div
                key={`${itemKey}-${col.key}`}
                className={cn(
                "px-4 h-full flex items-center overflow-hidden border-r border-border/5 last:border-r-0",
                col.align === 'right' ? "justify-end text-right" : col.align === 'center' ? "justify-center text-center" : "justify-start text-left",
                col.className
                )}
                style={{ width: columnWidths[colIdx], flexShrink: 0 }}
            >
                {col.cell(item, index)}
            </div>
            ))}
        </div>
        {expanded && renderExpandedRow && (
            <div
              className="w-full overflow-hidden"
              style={{ height: (typeof expandedRowHeight === 'function' ? expandedRowHeight(item, index) : expandedRowHeight) }}
            >
                {renderExpandedRow(item, index)}
            </div>
        )}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-20 text-center opacity-20 italic uppercase tracking-[0.4em] font-mono text-[10px]", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full w-full overflow-hidden font-mono", containerClassName)}>
      <div className="overflow-hidden border-b border-border/10 bg-card/10 z-20 shrink-0">
        <div className="flex" style={{ height: headerHeight }}>
          {columns.map((col, idx) => (
            <div
              key={`header-${col.key}`}
              className={cn(
                "px-4 h-full flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 border-r border-border/5 last:border-r-0",
                col.align === 'right' ? "justify-end text-right" : col.align === 'center' ? "justify-center text-center" : "justify-start text-left",
                col.headerClassName
              )}
              style={{ width: columnWidths[idx], flexShrink: 0 }}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <AutoSizer
          renderProp={({ height, width }) => (
            <List
              listRef={listRef}
              rowCount={data.length}
              rowHeight={getItemSize}
              overscanCount={overscanCount}
              className="custom-scrollbar"
              //@ts-ignore
              rowComponent={Row}
              rowProps={{} as any}
              style={{ height: height || 0, width: width || 0 }}
            />
          )}
        />
      </div>
    </div>
  );
}
