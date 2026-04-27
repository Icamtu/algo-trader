import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useExplorerStore, FileNode } from '../stores/explorerStore';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TreeItemProps {
  node: FileNode;
  level: number;
  onFileClick: (path: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, level, onFileClick }) => {
  const { expandedFolders, toggleFolder, selectedPath, deleteItem } = useExplorerStore();
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const isFolder = node.type === 'folder';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      toggleFolder(node.path);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 px-2 py-1 cursor-pointer group transition-all rounded-sm hover:bg-white/[0.03]",
          isSelected && "bg-white/[0.05] border-l-2 border-primary shadow-[inset_4px_0_12px_rgba(0,0,0,0.3)]"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isFolder ? (
            <>
              {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
              {isExpanded ? <FolderOpen className="w-4 h-4 text-primary/60" /> : <Folder className="w-4 h-4 text-primary/60" />}
            </>
          ) : (
            <>
              <div className="w-3" /> {/* Padding for no chevron */}
              <FileCode className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground/20 group-hover:text-muted-foreground/40")} />
            </>
          )}
          <span className={cn(
            "text-[10px] font-mono truncate uppercase tracking-wider",
            isSelected ? "text-foreground font-bold" : "text-muted-foreground/60 group-hover:text-muted-foreground/80"
          )}>
            {node.name}
          </span>
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
           <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="p-1 hover:bg-white/10 rounded-sm">
                  <MoreVertical className="w-3 h-3 text-muted-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-white/10 backdrop-blur-xl">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); deleteItem(node.path); }}
                  className="text-destructive text-[10px] font-mono flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" /> DELETE_OBJECT
                </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isFolder && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <TreeItem key={child.id} node={child} level={level + 1} onFileClick={onFileClick} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const StrategyExplorer: React.FC<{ onFileSelect: (path: string) => void }> = ({ onFileSelect }) => {
  const { tree, fetchTree, isLoading, refresh } = useExplorerStore();
  const [search, setSearch] = React.useState("");
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  React.useEffect(() => {
    fetchTree();
  }, []);

  if (isCollapsed) {
    return (
      <div className="w-[48px] border-r border-white/5 flex flex-col bg-black/10 backdrop-blur-3xl h-full relative overflow-hidden items-center py-4 shrink-0 transition-all">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-white/10 rounded-sm text-muted-foreground/40 hover:text-primary transition-all"
          title="Expand Explorer"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[240px] border-r border-white/5 flex flex-col bg-black/10 backdrop-blur-3xl h-full relative overflow-hidden group/explorer">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#f59e0b]" />
             Forge_Explorer
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={refresh} className="p-1.5 hover:bg-white/5 rounded-sm transition-all border border-transparent hover:border-white/10">
              <RefreshCw className={cn("w-3 h-3 text-muted-foreground/40", isLoading && "animate-spin")} />
            </button>
            <button onClick={() => setIsCollapsed(true)} className="p-1.5 hover:bg-white/5 rounded-sm transition-all border border-transparent hover:border-white/10">
              <PanelLeftClose className="w-3 h-3 text-muted-foreground/40" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FILTER_MODELS..."
            className="w-full bg-black/40 border border-white/5 px-8 py-1.5 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:border-primary/20 transition-all rounded-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {tree.length === 0 && !isLoading ? (
          <div className="text-[9px] text-muted-foreground/20 text-center py-10 font-mono italic">NO_OBJECTS_DETECTED</div>
        ) : (
          <div className="space-y-0.5">
            {tree.map(node => (
              <TreeItem key={node.id} node={node} level={0} onFileClick={onFileSelect} />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-white/5 bg-black/20">
        <button
          onClick={() => {
            const name = prompt("ENTER_KERNEL_NAME (e.g. momentum_v1):");
            if (name) {
              useExplorerStore.getState().createItem(name);
            }
          }}
          className="w-full py-2 border border-dashed border-white/10 text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 rounded-sm"
        >
          <Plus className="w-3 h-3" /> Initialize_Kernel
        </button>
      </div>
    </div>
  );
};

const ScrollArea: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
  <div className={cn("overflow-auto custom-scrollbar", className)}>
    {children}
  </div>
);
