import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { algoApi } from "../api/client";
import {
  StrategiesResponse,
  SystemHealth,
  TelemetryPnlResponse,
  TelemetryPerformanceResponse,
} from "../../../types/api";
import { toast } from "sonner";

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const res = await algoApi.getStrategies();
      return res?.data || res;
    },
    refetchInterval: 10000,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const res = await algoApi.getPositions();
      return res?.data || res;
    },
    refetchInterval: 5000,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await algoApi.getOrders();
      return res?.data || res;
    },
    refetchInterval: 5000,
  });
}

export function useFunds() {
  return useQuery({
    queryKey: ["funds"],
    queryFn: algoApi.getFunds,
    refetchInterval: 30000,
  });
}

export function useTradebook(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["tradebook", params],
    queryFn: async () => {
      const res = await algoApi.getTradebook(params);
      return res?.data || res;
    },
    refetchInterval: 10000,
  });
}

export function useSystemLogs() {
  return useQuery({
    queryKey: ["systemLogs"],
    queryFn: algoApi.getSystemLogs,
    refetchInterval: 5000,
  });
}

export function useRiskStatus() {
  return useQuery({
    queryKey: ["riskStatus"],
    queryFn: algoApi.getRiskStatus,
    refetchInterval: 10000,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["systemHealth"],
    queryFn: algoApi.getSystemStatus,
    refetchInterval: 5000,
  });
}

export function useStartStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => algoApi.startStrategy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy started successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to start strategy: ${error.message}`);
    },
  });
}

export function useStopStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => algoApi.stopStrategy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy stopped successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to stop strategy: ${error.message}`);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => algoApi.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled");
    },
    onError: (error: Error) => {
      toast.error(`Cancellation failed: ${error.message}`);
    },
  });
}

export function useTradingMode() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tradingMode"],
    queryFn: algoApi.getMode,
  });

  const mutation = useMutation({
    mutationFn: (mode: "sandbox" | "live") => algoApi.setMode(mode),
    onSuccess: (data) => {
      queryClient.setQueryData(["tradingMode"], data);
      // Invalidate all trading data when switching modes
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["funds"] });
      queryClient.invalidateQueries({ queryKey: ["riskStatus"] });

      const isLive = data.mode === "live";
      toast.success(`Switched to ${isLive ? "LIVE" : "SANDBOX"} mode`, {
        description: isLive ? "Real capital is now at risk." : "Simulation environment active.",
        className: isLive ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-warning text-warning-foreground"
      });
    },
    onError: (error: Error) => {
      toast.error(`Mode switch failed: ${error.message}`);
    }
  });

  return {
    mode: query.data?.mode as "sandbox" | "live" | undefined,
    isLoading: query.isLoading,
    setMode: mutation.mutate,
    isPending: mutation.isPending
  };
}

export function useAnalyzerStatus() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["analyzerStatus"],
    queryFn: algoApi.getAnalyzerStatus,
    refetchInterval: 10000,
  });

  const mutation = useMutation({
    mutationFn: (state: boolean) => algoApi.toggleAnalyzer(state),
    onSuccess: (data) => {
      queryClient.setQueryData(["analyzerStatus"], data);
      toast.success(`Analyzer ${data.state ? "Enabled" : "Disabled"}`, {
        description: data.state ? "Surgical AI precision active." : "Programmatic fallback active.",
      });
    },
    onError: (error: Error) => {
      toast.error(`Toggle failed: ${error.message}`);
    }
  });

  return {
    isEnabled: query.data?.state,
    isLoading: query.isLoading,
    toggle: mutation.mutate,
    isPending: mutation.isPending
  };
}

export const useTelemetryPnl = () => {
  return useQuery({
    queryKey: ["telemetry", "pnl"],
    queryFn: async () => {
      const { data } = await algoApi.getTelemetryPnl();
      return data as TelemetryPnlResponse;
    },
    refetchInterval: 10000,
  });
};

export const useTelemetryPerformance = () => {
  return useQuery({
    queryKey: ["telemetry", "performance"],
    queryFn: async () => {
      const { data } = await algoApi.getTelemetryPerformance();
      return data as TelemetryPerformanceResponse;
    },
    refetchInterval: 30000,
  });
};

export function useReconcilePositions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: algoApi.reconcilePositions,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["systemHealth"] });
      toast.success("Positions reconciled", {
        description: data.message || "Engine state synced with broker reality."
      });
    },
    onError: (error: Error) => {
      toast.error(`Reconciliation failed: ${error.message}`);
    },
  });
}
