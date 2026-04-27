import { create } from 'zustand';

export type LogLevel = 'SYSTEM' | 'EXEC' | 'WARN' | 'LOG' | 'ERROR';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
}

interface TerminalState {
  logs: LogEntry[];
  activeTab: string;
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
  setActiveTab: (tab: string) => void;
  executeCommand: (command: string) => Promise<void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  logs: [
    { id: '1', level: 'SYSTEM', message: 'Environment initialized: CUDA core allocation successful.', timestamp: new Date().toISOString() },
    { id: '2', level: 'EXEC', message: 'Connecting to Market Data Gateway...', timestamp: new Date().toISOString() },
    { id: '3', level: 'EXEC', message: 'Connection established. Latency: 12ms.', timestamp: new Date().toISOString() },
  ],
  activeTab: 'Terminal',

  addLog: (level, message) => set((state) => ({
    logs: [...state.logs, {
      id: Math.random().toString(36).substr(2, 9),
      level,
      message,
      timestamp: new Date().toISOString()
    }].slice(-500) // Keep last 500 logs
  })),

  clearLogs: () => set({ logs: [] }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  executeCommand: async (command) => {
    const { addLog } = get();
    addLog('EXEC', `> ${command}`);

    try {
      const { algoApi } = await import('@/features/openalgo/api/client');
      const response = await algoApi.sendTerminalCommand(command);

      if (response.status === 'EXEC_SUCCESS') {
        addLog('SYSTEM', response.output);
      } else {
        addLog('ERROR', response.output || response.message || 'Unknown error');
      }
    } catch (error) {
      addLog('ERROR', `CMD_FAILED: ${String(error)}`);
    }
  }
}));
