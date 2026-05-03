import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Search,
  Filter,
  Plus,
  FileText,
  Download,
  Link as LinkIcon,
  Tag as TagIcon,
  ChevronRight,
  Zap,
  Box,
  Brain,
  FileCode,
  PieChart,
  HardDrive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppModeStore } from "@/stores/appModeStore";
import { algoApi } from "@/features/aetherdesk/api/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Asset {
  id: number;
  name: string;
  asset_type: "strategy" | "dataset" | "result" | "model";
  description: string;
  tags: string[];
  version: string;
  file_path: string;
  metadata: any;
  created_at: string;
}

const assetTypeIcons = {
  strategy: <FileCode className="w-4 h-4" />,
  dataset: <Database className="w-4 h-4" />,
  result: <PieChart className="w-4 h-4" />,
  model: <Brain className="w-4 h-4" />
};

export default function AssetVault() {
  const { mode } = useAppModeStore();
  const { toast } = useToast();
  const isAD = mode === 'AD';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await algoApi.listVaultAssets(selectedType || undefined);
      const data = res?.data || res;
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
    } catch (err) {
      toast({ title: "VAULT_FETCH_ERR", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedType]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchAssets();
      return;
    }
    setLoading(true);
    try {
      const res = await algoApi.searchVaultAssets(searchTerm);
      const data = res?.data || res;
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
    } catch (err) {
      toast({ title: "SEARCH_ERR", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const primaryColorClass = isAD ? "text-amber-500" : "text-teal-500";
  const accentBorderClass = isAD ? "border-amber-500/20" : "border-teal-500/20";
  const accentBgClass = isAD ? "bg-amber-500/5" : "bg-teal-500/5";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/5 border-b border-border relative z-10">
        <div className="flex items-center gap-4">
          <div className={cn("bg-card/20 p-2 border rounded-sm shadow-xl", accentBorderClass)}>
            <HardDrive className={cn("h-6 w-6", primaryColorClass)} />
          </div>
          <div>
            <h1 className={cn("text-xl font-black font-mono tracking-[0.2em] uppercase", primaryColorClass)}>Asset_Vault_Kernel</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Zap className={cn("w-3 h-3 animate-pulse", primaryColorClass)} />
              <span className="text-[9px] font-mono font-black text-muted-foreground/60 tracking-widest uppercase italic">REGISTRY_v1.0 // MULTI_SOURCE_SYNC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="SEARCH_VAULT_RESOURCES..."
              className="pl-10 pr-4 py-1.5 h-9 bg-background/50 border-border/50 font-mono text-[10px] w-64 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all uppercase tracking-wider"
            />
          </div>
          <Button
            onClick={() => setShowRegisterModal(true)}
            className={cn("bg-primary text-black font-black font-mono text-[10px] uppercase tracking-widest rounded-none h-9 hover:bg-white")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ingest_Asset
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative z-10 overflow-hidden">
        {/* Left Sidebar: Filters */}
        <div className="w-64 border-r border-border/20 bg-card/5 p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div>
            <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-3">Resource_Types</div>
            <div className="space-y-1">
              {[
                { id: null, label: "ALL_ASSETS", icon: <Box className="w-3.5 h-3.5" /> },
                { id: "strategy", label: "STRATEGIES", icon: <FileCode className="w-3.5 h-3.5" /> },
                { id: "dataset", label: "DATASETS", icon: <Database className="w-3.5 h-3.5" /> },
                { id: "result", label: "BACKTEST_RESULTS", icon: <PieChart className="w-3.5 h-3.5" /> },
                { id: "model", label: "AI_WEIGHTS", icon: <Brain className="w-3.5 h-3.5" /> },
              ].map(t => (
                <button
                  key={t.label}
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono font-black uppercase tracking-widest transition-all",
                    selectedType === t.id
                      ? "bg-primary/10 " + primaryColorClass + " border-r-2 border-primary"
                      : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-card/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {t.icon}
                    {t.label}
                  </div>
                  {selectedType === t.id && <ChevronRight className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-3">Health_Status</div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">TS_Registry</span>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] h-4">SYNCED</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-black text-muted-foreground/40 uppercase tracking-widest">Storage_Pool</span>
                <span className="text-[9px] font-mono font-black text-foreground">1.2 GB / 10 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Asset Grid */}
        <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto custom-scrollbar bg-background/30">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
              <div className="text-[10px] font-mono font-black uppercase tracking-[0.5em]">Syncing_Vault...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {assets.map((asset) => (
                  <motion.div
                    key={asset.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedAsset(asset)}
                    className={cn(
                      "cursor-pointer group flex flex-col bg-card/20 border border-border/40 hover:border-primary/40 transition-all p-4 relative overflow-hidden",
                      selectedAsset?.id === asset.id && "border-primary bg-primary/5 shadow-2xl shadow-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("p-1.5 bg-background border border-border/50", primaryColorClass)}>
                        {assetTypeIcons[asset.asset_type] || <Box className="w-4 h-4" />}
                      </div>
                      <Badge variant="outline" className="border-border/30 text-[8px] font-mono font-black text-muted-foreground/40 px-1 py-0 h-4">
                        v{asset.version}
                      </Badge>
                    </div>

                    <h3 className="text-[12px] font-black uppercase tracking-widest mb-1 truncate text-foreground group-hover:text-primary transition-colors">
                      {asset.name}
                    </h3>
                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed mb-4 line-clamp-2 uppercase italic font-medium">
                      {asset.description || "NO_DESCRIPTION_PROVIDED_BY_KERNEL"}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-auto">
                      {Array.isArray(asset.tags) && asset.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[7px] font-mono font-black text-muted-foreground/30 border border-border/20 px-1.5 py-0.5 bg-card/40 uppercase">
                          {tag}
                        </span>
                      ))}
                      {Array.isArray(asset.tags) && asset.tags.length > 3 && (
                        <span className="text-[7px] font-mono font-black text-muted-foreground/20 px-1.5 py-0.5 uppercase">
                          +{asset.tags.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-5 group-hover:opacity-10 transition-opacity">
                       <Database className="w-full h-full rotate-12" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {!loading && assets.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20">
               <Database className="w-16 h-16 mb-4" />
               <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em]">NO_RECORDS_MATCHING_FILTER_CRITERIA</div>
            </div>
          )}
        </div>

        {/* Right Detail Panel */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-96 border-l border-border bg-background shadow-2xl relative z-20 flex flex-col"
            >
              <div className="p-6 border-b border-border bg-card/5">
                <div className="flex items-center justify-between mb-4">
                   <div className={cn("px-2 py-0.5 border text-[8px] font-mono font-black uppercase tracking-widest", isAD ? "border-amber-500/30 text-amber-500 bg-amber-500/5" : "border-teal-500/30 text-teal-500 bg-teal-500/5")}>
                     {selectedAsset.asset_type}_NODE
                   </div>
                   <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground/40 hover:text-foreground p-1 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                   </button>
                </div>
                <h2 className="text-xl font-black uppercase tracking-widest mb-2 font-display">{selectedAsset.name}</h2>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-widest">VERSION:</span>
                  <span className={cn("text-[10px] font-mono font-black", primaryColorClass)}>v{selectedAsset.version}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <section>
                  <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <TagIcon className="w-3 h-3" />
                    Metadata_Inspector
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-card/5 border border-border/20">
                       <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase block mb-1">Created_At</span>
                       <span className="text-[10px] font-mono text-foreground">{new Date(selectedAsset.created_at).toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-card/5 border border-border/20">
                       <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase block mb-1">Storage_Path</span>
                       <span className="text-[10px] font-mono text-foreground truncate block italic">{selectedAsset.file_path}</span>
                    </div>
                    <div className="p-3 bg-card/5 border border-border/20">
                       <span className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase block mb-2">Alpha_Tags</span>
                       <div className="flex flex-wrap gap-2">
                         {Array.isArray(selectedAsset.tags) && selectedAsset.tags.map(tag => (
                           <Badge key={tag} className="bg-primary/5 text-primary border-primary/20 text-[8px] uppercase">{tag}</Badge>
                         ))}
                       </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="text-[8px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <Database className="w-3 h-3" />
                    System_Directives
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-none border-border/50 hover:bg-primary/5 hover:border-primary group">
                      <Download className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary" />
                      <span className="text-[8px] font-mono font-black uppercase tracking-widest">PULL_BIN</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 rounded-none border-border/50 hover:bg-primary/5 hover:border-primary group">
                      <LinkIcon className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary" />
                      <span className="text-[8px] font-mono font-black uppercase tracking-widest">MAP_TO_FORGE</span>
                    </Button>
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-border bg-card/5">
                <Button className={cn("w-full bg-primary text-black font-black font-mono text-[10px] uppercase tracking-widest rounded-none h-11")}>
                   <FileText className="w-4 h-4 mr-2" />
                   Open_In_Strategy_Editor
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
