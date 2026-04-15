import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap, Lock, Activity, Eye, EyeOff, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      // Listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Credentials do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Credential updated successfully");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden industrial-grid">
        <div className="noise-overlay" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Activity className="w-6 h-6 text-amber-500 animate-spin mx-auto" aria-hidden="true" />
          <p className="text-[10px] font-mono font-black text-muted-foreground/40 uppercase tracking-[0.3em]">Validating_Recovery_Vector...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden industrial-grid">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      {/* Structural Borders */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md mx-4 z-10"
      >
        {/* Brand Unit */}
        <div className="text-center mb-10 space-y-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-4"
          >
            <div className="w-14 h-14 bg-card border-2 border-amber-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,176,0,0.1)] relative group">
              <div className="absolute inset-0 border border-amber-500/40 animate-pulse" />
              <Zap className="w-7 h-7 text-amber-500" aria-hidden="true" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black font-display tracking-tighter text-foreground leading-none uppercase">AetherDesk</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#ffb000]" />
                <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-[0.4em]">CREDENTIAL_RESET</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Reset Matrix */}
        <div className="border border-white/5 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <Lock className="w-20 h-20 text-amber-500" aria-hidden="true" />
          </div>

          <div className="mb-8">
            <h2 className="text-[11px] font-mono font-black text-foreground uppercase tracking-[0.2em]">Set_New_Credential</h2>
            <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-2">Enter a new credential alpha for your station</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label
                htmlFor="reset-password-new"
                className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1"
              >
                New_Credential_Alpha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reset-password-new"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full bg-black/20 border border-white/5 px-10 py-3 text-[11px] font-mono font-bold text-foreground focus:outline-none focus:border-amber-500/30 focus:bg-amber-500/5 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="reset-password-confirm"
                className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1"
              >
                Confirm_Credential
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reset-password-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full bg-black/20 border border-white/5 px-10 py-3 text-[11px] font-mono font-bold text-foreground focus:outline-none focus:border-amber-500/30 focus:bg-amber-500/5 transition-all outline-none"
                />
              </div>
            </div>

            <button
              id="reset-password-submit"
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-amber-500 hover:bg-white text-black font-black font-mono text-[11px] uppercase tracking-[0.5em] transition-all relative overflow-hidden group disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              {loading ? (
                <Activity className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <div className="flex items-center justify-center gap-3">
                  UPDATE_CREDENTIAL
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
