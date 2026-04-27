import { create } from 'zustand';
import { algoApi } from '@/features/openalgo/api/client';
import { toast } from 'sonner';

export type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  size?: number;
  modified?: number;
  ext?: string;
};

interface ExplorerState {
  tree: FileNode[];
  isLoading: boolean;
  selectedPath: string | null;
  expandedFolders: Set<string>;

  // Actions
  fetchTree: () => Promise<void>;
  setSelectedPath: (path: string | null) => void;
  toggleFolder: (path: string) => void;
  deleteItem: (path: string) => Promise<void>;
  createItem: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  tree: [],
  isLoading: false,
  selectedPath: null,
  expandedFolders: new Set<string>(),

  fetchTree: async () => {
    set({ isLoading: true });
    try {
      const res = await algoApi.getExplorerTree();
      set({ tree: res.tree });
    } catch (err) {
      console.error("Explorer tree fetch failed", err);
      toast.error("Failed to load strategy explorer");
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedPath: (path) => set({ selectedPath: path }),

  toggleFolder: (path) => {
    const { expandedFolders } = get();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    set({ expandedFolders: newExpanded });
  },

  deleteItem: async (path) => {
    try {
      await algoApi.deleteExplorerItem(path);
      toast.success("Deleted successfully");
      await get().fetchTree();
    } catch (err) {
      toast.error("Delete failed");
    }
  },

  createItem: async (name: string) => {
    try {
      await algoApi.createStrategy({ name });
      toast.success("Strategy kernel initialized");
      await get().fetchTree();
    } catch (err) {
      toast.error("Failed to initialize strategy");
    }
  },
  refresh: async () => {
    await get().fetchTree();
  }
}));
