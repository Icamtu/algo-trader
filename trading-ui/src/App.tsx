import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import { TerminalSettingsProvider } from "@/contexts/TerminalSettingsContext";
import { ThemeOrchestrator } from "./components/trading/ThemeOrchestrator";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Risk = lazy(() => import("./pages/Risk"));
const StrategyLab = lazy(() => import("./pages/StrategyLab"));
const MarketScanner = lazy(() => import("./pages/MarketScanner"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const TradeJournal = lazy(() => import("./pages/TradeJournal"));
const Infrastructure = lazy(() => import("./pages/Infrastructure"));
const ExpertTerminal = lazy(() => import("./pages/ExpertTerminal"));
const Alerts = lazy(() => import("./pages/Alerts"));
const AetherAIChartPage = lazy(() => import("./pages/AetherAIChartPage"));
const Auth = lazy(() => import("./pages/Auth"));
const BrokerRegistry = lazy(() => import("./pages/BrokerRegistry"));
const Roles = lazy(() => import("./pages/Roles"));
const Profile = lazy(() => import("./pages/Profile"));
const OpenAlgoHub = lazy(() => import("./pages/OpenAlgoHub"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// OpenAlgo Integration Components (Lazy)
const Orders = lazy(() => import("./integrations/openalgo/pages/OrderBookPage").then(module => ({ default: module.OrderBookPage })));
const Trades = lazy(() => import("./integrations/openalgo/pages/TradesPage").then(module => ({ default: module.TradesPage })));
const Positions = lazy(() => import("./integrations/openalgo/pages/PositionsPage").then(module => ({ default: module.PositionsPage })));
const Holdings = lazy(() => import("./integrations/openalgo/pages/HoldingsPage").then(module => ({ default: module.HoldingsPage })));
const Logs = lazy(() => import("./integrations/openalgo/pages/LogsPage").then(module => ({ default: module.LogsPage })));
const Connectivity = lazy(() => import("./integrations/openalgo/pages/ConnectivityPage").then(module => ({ default: module.ConnectivityPage })));
const BrokerSelect = lazy(() => import("./integrations/openalgo/pages/BrokerSelectPage").then(module => ({ default: module.BrokerSelectPage })));
const MasterContract = lazy(() => import("./integrations/openalgo/pages/MasterContractPage").then(module => ({ default: module.MasterContractPage })));
const SandboxConfig = lazy(() => import("./integrations/openalgo/pages/SandboxConfigPage").then(module => ({ default: module.SandboxConfigPage })));
const SandboxPnL = lazy(() => import("./integrations/openalgo/pages/SandboxPnLPage").then(module => ({ default: module.SandboxPnLPage })));
const Analyzer = lazy(() => import("./integrations/openalgo/pages/AnalyzerPage").then(module => ({ default: module.AnalyzerPage })));
const ActionCenter = lazy(() => import("./integrations/openalgo/pages/ActionCenterPage").then(module => ({ default: module.ActionCenterPage })));
const OptionChainPage = lazy(() => import("./integrations/openalgo/pages/OptionChainPage"));
const GEXDashboardPage = lazy(() => import("./integrations/openalgo/pages/GEXDashboardPage"));
const OIProfilePage = lazy(() => import("./integrations/openalgo/pages/OIProfilePage"));
const HealthMonitorPage = lazy(() => import("./integrations/openalgo/pages/HealthMonitorPage"));
const PlaygroundPage = lazy(() => import("./integrations/openalgo/pages/PlaygroundPage"));
const OITrackerPage = lazy(() => import("./integrations/openalgo/pages/OITrackerPage"));
const VolSurfacePage = lazy(() => import("./integrations/openalgo/pages/VolSurfacePage"));
const IVSmilePage = lazy(() => import("./integrations/openalgo/pages/IVSmilePage"));
const IVChartPage = lazy(() => import("./integrations/openalgo/pages/IVChartPage"));
const HistorifyPage = lazy(() => import("./integrations/openalgo/pages/HistorifyPage"));
const MaxPainPage = lazy(() => import("./integrations/openalgo/pages/MaxPainPage"));
const StraddleLabPage = lazy(() => import("./integrations/openalgo/pages/StraddleLabPage"));

// Synchronous core components
import { OpenAlgoLayout } from "./components/trading/OpenAlgoLayout";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
    <div className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-primary animate-pulse">
      Initialising_Module_Kernel...
    </div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
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
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </TradingModeProvider>
      </TerminalSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

