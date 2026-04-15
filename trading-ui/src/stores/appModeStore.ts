import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppModeState {
  mode: 'AD' | 'OA';
  toggleMode: () => void;
  setMode: (mode: 'AD' | 'OA') => void;
}

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      mode: 'AD',
      toggleMode: () => set((state) => ({ mode: state.mode === 'AD' ? 'OA' : 'AD' })),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'aetherdesk-app-mode',
    }
  )
);
