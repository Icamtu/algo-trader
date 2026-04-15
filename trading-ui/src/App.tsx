import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import { TerminalSettingsProvider } from "@/contexts/TerminalSettingsContext";
import Index from "./pages/Index";
import Risk from "./pages/Risk";
import StrategyLab from "./pages/StrategyLab";
import MarketScanner from "./pages/MarketScanner";
import Portfolio from "./pages/Portfolio";
import TradeJournal from "./pages/TradeJournal";
import Infrastructure from "./pages/Infrastructure";
import ExpertTerminal from "./pages/ExpertTerminal";
import Alerts from "./pages/Alerts";
import AetherAIChartPage from "./pages/AetherAIChartPage";
import Auth from "./pages/Auth";
import BrokerRegistry from "./pages/BrokerRegistry";
import { useAppModeStore } from './stores/appModeStore';
import { OpenAlgoLayout } from "./components/trading/OpenAlgoLayout";
import OpenAlgoHub from "./pages/OpenAlgoHub";
import { OrderBookPage as Orders } from "./integrations/openalgo/pages/OrderBookPage";
import { TradesPage as Trades } from "./integrations/openalgo/pages/TradesPage";
import { PositionsPage as Positions } from "./integrations/openalgo/pages/PositionsPage";
import { HoldingsPage as Holdings } from "./integrations/openalgo/pages/HoldingsPage";
import { LogsPage as Logs } from "./integrations/openalgo/pages/LogsPage";
import { ConnectivityPage as Connectivity } from "./integrations/openalgo/pages/ConnectivityPage";
import { BrokerSelectPage as BrokerSelect } from "./integrations/openalgo/pages/BrokerSelectPage";
import { MasterContractPage as MasterContract } from "./integrations/openalgo/pages/MasterContractPage";
import { SandboxConfigPage as SandboxConfig } from "./integrations/openalgo/pages/SandboxConfigPage";
import { SandboxPnLPage as SandboxPnL } from "./integrations/openalgo/pages/SandboxPnLPage";
import { AnalyzerPage as Analyzer } from "./integrations/openalgo/pages/AnalyzerPage";
import { ActionCenterPage as ActionCenter } from "./integrations/openalgo/pages/ActionCenterPage";
import OptionChainPage from "./integrations/openalgo/pages/OptionChainPage";
import GEXDashboardPage from "./integrations/openalgo/pages/GEXDashboardPage";
import OIProfilePage from "./integrations/openalgo/pages/OIProfilePage";
import HealthMonitorPage from "./integrations/openalgo/pages/HealthMonitorPage";
import PlaygroundPage from "./integrations/openalgo/pages/PlaygroundPage";
import OITrackerPage from "./integrations/openalgo/pages/OITrackerPage";
import VolSurfacePage from "./integrations/openalgo/pages/VolSurfacePage";
import IVSmilePage from "./integrations/openalgo/pages/IVSmilePage";
import IVChartPage from "./integrations/openalgo/pages/IVChartPage";
import HistorifyPage from "./integrations/openalgo/pages/HistorifyPage";
import MaxPainPage from "./integrations/openalgo/pages/MaxPainPage";
import StraddleLabPage from "./integrations/openalgo/pages/StraddleLabPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import { ThemeOrchestrator } from "./components/trading/ThemeOrchestrator";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        Initialising_Core_Auth...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TerminalSettingsProvider>
        <TradingModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ThemeOrchestrator />
              <div className="noise-overlay" />
              <div className="scanline-overlay" />
              <Routes>
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/risk" element={<ProtectedRoute><Risk /></ProtectedRoute>} />
                <Route path="/strategy-lab" element={<ProtectedRoute><StrategyLab /></ProtectedRoute>} />
                <Route path="/scanner" element={<ProtectedRoute><MarketScanner /></ProtectedRoute>} />
                <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><TradeJournal /></ProtectedRoute>} />
                <Route path="/infrastructure" element={<ProtectedRoute><Infrastructure /></ProtectedRoute>} />
                <Route path="/terminal" element={<ProtectedRoute><ExpertTerminal /></ProtectedRoute>} />
                <Route path="/charting" element={<ProtectedRoute><AetherAIChartPage /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/brokers" element={<ProtectedRoute><BrokerRegistry /></ProtectedRoute>} />
                <Route path="/orders" element={<Navigate to="/openalgo/orders" replace />} />
                <Route path="/trades" element={<Navigate to="/openalgo/trades" replace />} />
                <Route path="/positions" element={<Navigate to="/openalgo/positions" replace />} />
                <Route path="/holdings" element={<Navigate to="/openalgo/holdings" replace />} />
                <Route path="/logs" element={<Navigate to="/openalgo/logs" replace />} />
                
                <Route path="/openalgo" element={<ProtectedRoute><OpenAlgoLayout /></ProtectedRoute>}>
                  <Route index element={<OpenAlgoHub />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="trades" element={<Trades />} />
                  <Route path="positions" element={<Positions />} />
                  <Route path="holdings" element={<Holdings />} />
                  <Route path="logs" element={<Logs />} />
                  <Route path="connectivity" element={<Connectivity />} />
                  <Route path="broker" element={<BrokerSelect />} />
                  <Route path="master-contract" element={<MasterContract />} />
                  <Route path="sandbox" element={<SandboxConfig />} />
                  <Route path="sandbox/pnl" element={<SandboxPnL />} />
                  <Route path="analyzer" element={<Analyzer />} />
                  <Route path="action-center" element={<ActionCenter />} />
                  <Route path="option-chain" element={<OptionChainPage />} />
                  <Route path="gex" element={<GEXDashboardPage />} />
                  <Route path="oi-profile" element={<OIProfilePage />} />
                  <Route path="health" element={<HealthMonitorPage />} />
                  <Route path="playground" element={<PlaygroundPage />} />
                  <Route path="oi-tracker" element={<OITrackerPage />} />
                  <Route path="vol-surface" element={<VolSurfacePage />} />
                  <Route path="iv-smile" element={<IVSmilePage />} />
                  <Route path="iv-chart" element={<IVChartPage />} />
                  <Route path="historify" element={<HistorifyPage />} />
                  <Route path="max-pain" element={<MaxPainPage />} />
                  <Route path="straddle-lab" element={<StraddleLabPage />} />
                </Route>
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </TradingModeProvider>
      </TerminalSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

