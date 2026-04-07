import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // TEMP: Bypass auth for browser verification (revert after testing)
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
      <TradingModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TradingModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

