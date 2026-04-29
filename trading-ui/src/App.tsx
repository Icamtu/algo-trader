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
import { AetherProvider } from "@/contexts/AetherContext";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const LandingDashboard = lazy(() => import("./pages/LandingDashboard"));
const AuditCenter = lazy(() => import("./pages/AuditCenter"));
const StrategyMonitoring = lazy(() => import("./pages/StrategyMonitoring"));
const AutoResearchPage = lazy(() => import("./pages/AutoResearchPage"));
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
const AetherHub = lazy(() => import("./pages/AetherHub"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// AetherDesk Integration Components (Lazy)
const Orders = lazy(() => import("./integrations/aetherdesk/pages/OrderBookPage").then(module => ({ default: module.OrderBookPage })));
const Trades = lazy(() => import("./integrations/aetherdesk/pages/TradesPage").then(module => ({ default: module.TradesPage })));
const Positions = lazy(() => import("./integrations/aetherdesk/pages/PositionsPage").then(module => ({ default: module.PositionsPage })));
const Holdings = lazy(() => import("./integrations/aetherdesk/pages/HoldingsPage").then(module => ({ default: module.HoldingsPage })));
const Logs = lazy(() => import("./integrations/aetherdesk/pages/LogsPage").then(module => ({ default: module.LogsPage })));
const Connectivity = lazy(() => import("./integrations/aetherdesk/pages/ConnectivityPage").then(module => ({ default: module.ConnectivityPage })));
const BrokerSelect = lazy(() => import("./integrations/aetherdesk/pages/BrokerSelectPage").then(module => ({ default: module.BrokerSelectPage })));
const MasterContract = lazy(() => import("./integrations/aetherdesk/pages/MasterContractPage").then(module => ({ default: module.MasterContractPage })));
const SandboxConfig = lazy(() => import("./integrations/aetherdesk/pages/SandboxConfigPage").then(module => ({ default: module.SandboxConfigPage })));
const SandboxPnL = lazy(() => import("./integrations/aetherdesk/pages/SandboxPnLPage").then(module => ({ default: module.SandboxPnLPage })));
const Analyzer = lazy(() => import("./integrations/aetherdesk/pages/AnalyzerPage").then(module => ({ default: module.AnalyzerPage })));
const ActionCenter = lazy(() => import("./integrations/aetherdesk/pages/ActionCenterPage").then(module => ({ default: module.ActionCenterPage })));
const OptionChainPage = lazy(() => import("./integrations/aetherdesk/pages/OptionChainPage"));
const GEXDashboardPage = lazy(() => import("./integrations/aetherdesk/pages/GEXDashboardPage"));
const OIProfilePage = lazy(() => import("./integrations/aetherdesk/pages/OIProfilePage"));
const HealthMonitorPage = lazy(() => import("./integrations/aetherdesk/pages/HealthMonitorPage"));
const PlaygroundPage = lazy(() => import("./integrations/aetherdesk/pages/PlaygroundPage"));
const OITrackerPage = lazy(() => import("./integrations/aetherdesk/pages/OITrackerPage"));
const VolSurfacePage = lazy(() => import("./integrations/aetherdesk/pages/VolSurfacePage"));
const IVSmilePage = lazy(() => import("./integrations/aetherdesk/pages/IVSmilePage"));
const IVChartPage = lazy(() => import("./integrations/aetherdesk/pages/IVChartPage"));
const HistorifyPage = lazy(() => import("./integrations/aetherdesk/pages/HistorifyPage"));
const MaxPainPage = lazy(() => import("./integrations/aetherdesk/pages/MaxPainPage"));
const StraddleLabPage = lazy(() => import("./integrations/aetherdesk/pages/StraddleLabPage"));
const StrategyRegistry = lazy(() => import("./integrations/aetherdesk/pages/StrategyRegistryPage"));
const MarketRegime = lazy(() => import("./pages/MarketRegimePage"));
const StrategyManagerPage = lazy(() => import("./features/strategy-manager/StrategyManagerPage"));
const PnLTracker = lazy(() => import("./pages/PnLTracker"));

const IndicatorFactory = lazy(() => import("./pages/IndicatorFactory"));
const IntelligenceHubPage = lazy(() => import("./pages/IntelligenceHubPage"));
const AssetVault = lazy(() => import("./pages/AssetVault"));

// Settings pages
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout").then(module => ({ default: module.SettingsLayout })));
const Preferences = lazy(() => import("./pages/settings/Preferences"));
const Charts = lazy(() => import("./pages/settings/Charts"));
const ApiKeys = lazy(() => import("./pages/settings/ApiKeys"));
const BacktestDefaults = lazy(() => import("./pages/settings/BacktestDefaults"));

// Synchronous core components
import { AetherLayout } from "./components/trading/AetherLayout";
import { AetherAppShell } from "./components/layout/AetherAppShell";

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
  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/auth" replace />;
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
            <AetherProvider>
              <ThemeOrchestrator />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    <Route element={<ProtectedRoute><AetherAppShell /></ProtectedRoute>}>
                      {/* Aether Integrated Core */}
                      <Route path="/" element={<LandingDashboard />} />
                      <Route path="/aetherdesk/audit" element={<AuditCenter />} />
                      <Route path="/execution/command-center" element={<StrategyManagerPage />} />
                      <Route path="/execution/registry" element={<StrategyMonitoring />} />
                      <Route path="/intelligence" element={<IntelligenceHubPage />} />
                      <Route path="/intelligence/regime" element={<MarketRegime />} />
                      <Route path="/intelligence/research" element={<AutoResearchPage />} />
                      <Route path="/intelligence/gex" element={<GEXDashboardPage />} />
                      <Route path="/intelligence/historify" element={<HistorifyPage />} />
                      <Route path="/intelligence/oi-profile" element={<OIProfilePage />} />
                      <Route path="/intelligence/oi-tracker" element={<OITrackerPage />} />
                      <Route path="/intelligence/vol-surface" element={<VolSurfacePage />} />
                      <Route path="/intelligence/iv-smile" element={<IVSmilePage />} />
                      <Route path="/intelligence/iv-chart" element={<IVChartPage />} />
                      <Route path="/intelligence/option-chain" element={<OptionChainPage />} />
                      <Route path="/intelligence/max-pain" element={<MaxPainPage />} />
                      <Route path="/intelligence/straddle-lab" element={<StraddleLabPage />} />
                      <Route path="/intelligence/indicator-factory" element={<IndicatorFactory />} />
                      <Route path="/governance" element={<Infrastructure />} />
                      <Route path="/risk" element={<Risk />} />
                      <Route path="/pnl-tracker" element={<PnLTracker />} />
                      <Route path="/journal" element={<TradeJournal />} />

                      {/* Legacy / AetherDesk Bridges */}
                      <Route path="/aetherdesk/strategy-registry" element={<StrategyRegistry />} />
                      <Route path="/strategy-lab" element={<StrategyLab />} />
                      <Route path="/scanner" element={<MarketScanner />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/infrastructure" element={<Infrastructure />} />
                      <Route path="/terminal" element={<ExpertTerminal />} />
                      <Route path="/charting" element={<AetherAIChartPage />} />
                      <Route path="/alerts" element={<Alerts />} />
                      <Route path="/brokers" element={<BrokerRegistry />} />
                      <Route path="/roles" element={<Roles />} />

                      {/* Settings Hub - Nested Routes */}
                      <Route path="/profile" element={<SettingsLayout><Profile /></SettingsLayout>} />
                      <Route path="/profile/preferences" element={<SettingsLayout><Preferences /></SettingsLayout>} />
                      <Route path="/profile/charts" element={<SettingsLayout><Charts /></SettingsLayout>} />
                      <Route path="/profile/api-keys" element={<SettingsLayout><ApiKeys /></SettingsLayout>} />
                      <Route path="/profile/backtest" element={<SettingsLayout><BacktestDefaults /></SettingsLayout>} />

                      <Route path="/aetherdesk" element={<AetherLayout />}>
                        <Route index element={<AetherHub />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="trades" element={<Trades />} />
                        <Route path="positions" element={<Positions />} />
                        <Route path="holdings" element={<Holdings />} />
                        <Route path="logs" element={<Logs />} />
                        <Route path="connectivity" element={<Connectivity />} />
                        <Route path="broker" element={<BrokerSelect />} />
                        <Route path="master-contract" element={<MasterContract />} />
                        <Route path="simulation" element={<SandboxConfig />} />
                        <Route path="simulation/pnl" element={<SandboxPnL />} />
                        <Route path="analyzer" element={<Analyzer />} />
                        <Route path="action-center" element={<ActionCenter />} />
                        <Route path="option-chain" element={<Navigate to="/intelligence/option-chain" replace />} />
                        <Route path="gex" element={<Navigate to="/intelligence/gex" replace />} />
                        <Route path="oi-profile" element={<Navigate to="/intelligence/oi-profile" replace />} />
                        <Route path="health" element={<HealthMonitorPage />} />
                        <Route path="playground" element={<PlaygroundPage />} />
                        <Route path="oi-tracker" element={<Navigate to="/intelligence/oi-tracker" replace />} />
                        <Route path="vol-surface" element={<Navigate to="/intelligence/vol-surface" replace />} />
                        <Route path="iv-smile" element={<Navigate to="/intelligence/iv-smile" replace />} />
                        <Route path="iv-chart" element={<Navigate to="/intelligence/iv-chart" replace />} />
                        <Route path="historify" element={<Navigate to="/intelligence/historify" replace />} />
                        <Route path="max-pain" element={<Navigate to="/intelligence/max-pain" replace />} />
                        <Route path="straddle-lab" element={<Navigate to="/intelligence/straddle-lab" replace />} />
                        <Route path="strategy-registry" element={<StrategyRegistry />} />
                        <Route path="vault" element={<AssetVault />} />
                      </Route>

                      {/* Redirections for legacy paths */}
                      <Route path="/orders" element={<Navigate to="/aetherdesk/orders" replace />} />
                      <Route path="/trades" element={<Navigate to="/aetherdesk/trades" replace />} />
                      <Route path="/positions" element={<Navigate to="/aetherdesk/positions" replace />} />
                      <Route path="/holdings" element={<Navigate to="/aetherdesk/holdings" replace />} />
                      <Route path="/logs" element={<Navigate to="/aetherdesk/logs" replace />} />
                      <Route path="/audit" element={<Navigate to="/aetherdesk/audit" replace />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AetherProvider>
          </TooltipProvider>
        </TradingModeProvider>
      </TerminalSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
