import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode, Search, Plus, Trash2, ChevronRight, RefreshCw } from "lucide-react";
import { algoApi } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAppModeStore } from "@/stores/appModeStore";

interface StrategyFile {
  name: string;
  content?: string;
}

interface StrategyLibrarySidebarProps {
  onSelect: (filename: string, content: string) => void;
  currentFile: string | null;
}

export function StrategyLibrarySidebar({ onSelect, currentFile }: StrategyLibrarySidebarProps) {
  const { toast } = useToast();
  const { mode } = useAppModeStore();
  const isAD = mode === 'AD';

  const [files, setFiles] = useState<StrategyFile[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await algoApi.getStrategyFiles();
      const fileList = res.files.map((f: string) => ({ name: f }));
      setFiles(fileList);
    } catch (err) {
      console.error("Failed to load strategy files", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileSelect = async (filename: string) => {
    try {
      const res = await algoApi.getStrategyFile(filename);
      onSelect(filename, res.content);
    } catch (err) {
      toast({ variant: "destructive", title: "STRAT_LOAD_ERR", description: String(err) });
    }
  };

  const handleCreateNew = async () => {
    const name = prompt("Enter Strategy Name (e.g. MyScalper):");
    if (!name) return;
    try {
      await algoApi.createStrategy({ name });
      toast({ title: "STRAT_CREATED", description: `${name}.py generated from template.` });
      fetchFiles();
    } catch (err) {
      toast({ variant: "destructive", title: "CREATE_ERR", description: String(err) });
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";

  return (
    <div className="w-[240px] border-r border-white/5 flex flex-col bg-black/10 backdrop-blur-3xl h-full relative overflow-hidden">
      <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

      <div className="p-5 border-b border-white/5 relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-col">
            <h3 className={cn("text-[11px] font-mono font-black uppercase tracking-[0.25em] flex items-center gap-2", primaryColorClass)}>
              <div className={cn("w-1.5 h-1.5 rounded-full", isAD ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" : "bg-teal-500 shadow-[0_0_8px_#14b8a6]")} />
              Core_Repo
            </h3>
            <span className="text-[7px] font-mono font-black text-muted-foreground/30 uppercase mt-1 tracking-widest">Local_Asset_Stack</span>
          </div>
          <button
            onClick={fetchFiles}
            className="p-1.5 hover:bg-white/5 rounded-sm transition-all border border-transparent hover:border-white/10"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground/40 hover:text-foreground transition-colors", isLoading && "animate-spin")} />
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FILTER_MODELS..."
            className="w-full bg-black/40 border border-white/10 px-9 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:border-primary/40 focus:bg-black/60 transition-all rounded-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-1.5 relative z-10">
        <AnimatePresence mode="popLayout">
          {filteredFiles.map((file) => (
            <motion.button
              key={file.name}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 10, opacity: 0 }}
              onClick={() => handleFileSelect(file.name)}
              className={cn(
                "w-full text-left px-4 py-2.5 flex items-center justify-between group transition-all relative rounded-sm border",
                currentFile === file.name
                    ? "bg-white/[0.05] border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                    : "hover:bg-white/[0.03] border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <FileCode className={cn(
                      "w-4 h-4 transition-colors",
                      currentFile === file.name ? primaryColorClass : "text-muted-foreground/20 group-hover:text-muted-foreground/40"
                  )} />
                  {currentFile === file.name && (
                    <div className={cn("absolute inset-0 blur-sm opacity-50", primaryColorClass)}>
                      <FileCode className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <span className={cn(
                    "text-[10px] font-mono font-black uppercase tracking-wider truncate max-w-[130px] transition-colors",
                    currentFile === file.name ? "text-foreground" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                )}>
                    {file.name.replace('.py', '')}
                </span>
              </div>
              <ChevronRight className={cn(
                  "w-3.5 h-3.5 transition-all opacity-0 group-hover:opacity-100",
                  currentFile === file.name ? "text-primary opacity-100 translate-x-0" : "text-muted-foreground/20 translate-x-2 group-hover:translate-x-0"
              )} />

              {currentFile === file.name && (
                  <motion.div
                    layoutId="activeFileIndicator"
                    className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-current rounded-full", primaryColorClass)}
                  />
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-white/5 bg-black/20 relative z-10">
        <button
          onClick={handleCreateNew}
          className="w-full py-2.5 border border-dashed border-white/10 text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em] hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 rounded-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Initialize_Asset
        </button>
      </div>

      <div className="px-5 py-3 border-t border-white/5 bg-black/40 flex items-center justify-between relative z-10">
         <div className="flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]", isAD ? "text-amber-500 bg-amber-500" : "text-teal-500 bg-teal-500")} />
            <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">Stack_Ready</span>
         </div>
         <span className="text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-tighter">— {files.length}_OBJECTS</span>
      </div>
    </div>
  );
}
