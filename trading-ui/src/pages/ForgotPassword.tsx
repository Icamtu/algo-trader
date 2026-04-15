import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Zap, Lock, Activity, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Endpoint required").email("Invalid endpoint format"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Recovery link dispatched to secure endpoint");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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
                <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-[0.4em]">RECOVERY_PROTOCOL</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recovery Matrix */}
        <div className="border border-white/5 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <Lock className="w-20 h-20 text-amber-500" aria-hidden="true" />
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 space-y-6"
            >
              <div className="w-16 h-16 mx-auto border-2 border-amber-500/30 bg-amber-500/5 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-amber-500" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono font-bold text-foreground uppercase tracking-widest">Recovery_Link_Dispatched</p>
                <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">Check your secure endpoint for the reset vector</p>
              </div>
              <Link
                to="/auth"
                id="forgot-password-back-link"
                className="inline-flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-500/60 hover:text-amber-500 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Return_To_Access
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-[11px] font-mono font-black text-foreground uppercase tracking-[0.2em]">Reset_Credential_Alpha</h2>
                <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-2">Enter your secure endpoint to receive a recovery vector</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">
                          Secure_Endpoint
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                              <Lock className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <Input
                              {...field}
                              type="email"
                              placeholder="TRADER@INSTITUTION.DOM"
                              autoComplete="email"
                              className="w-full bg-black/20 border border-white/5 px-10 py-3 text-[11px] font-mono font-bold text-foreground focus:outline-none focus:border-amber-500/30 focus:bg-amber-500/5 transition-all outline-none"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] font-mono font-bold text-red-500/80 uppercase tracking-tight ml-1" />
                      </FormItem>
                    )}
                  />

                  <button
                    id="forgot-password-submit"
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-amber-500 hover:bg-white text-black font-black font-mono text-[11px] uppercase tracking-[0.5em] transition-all relative overflow-hidden group disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    {loading ? (
                      <Activity className="w-5 h-5 animate-spin mx-auto" aria-hidden="true" />
                    ) : (
                      "DISPATCH_RECOVERY"
                    )}
                  </button>

                  <Link
                    to="/auth"
                    id="forgot-password-return-link"
                    className="flex items-center justify-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Return_To_Access
                  </Link>
                </form>
              </Form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
