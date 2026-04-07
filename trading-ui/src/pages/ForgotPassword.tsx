import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Layers, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight neon-text-cyan">AetherDesk</span>
          </div>
        </div>

        <div className="glass-panel-elevated rounded-xl p-6 border border-border">
          <h2 className="text-sm font-semibold text-foreground mb-1">Reset Password</h2>
          <p className="text-xs text-muted-foreground mb-6">Enter your email and we'll send you a reset link.</p>

          {sent ? (
            <div className="text-center py-4">
              <p className="text-sm text-neon-green mb-4">Check your email for the reset link.</p>
              <Link to="/auth" className="text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full glow-button rounded-md py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
