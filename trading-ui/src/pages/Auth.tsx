import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Layers, ArrowRight, Shield, Zap, Lock, Terminal, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const authSchema = z.object({
    email: z.string().min(1, "Endpoint required").email("Invalid endpoint format"),
    password: z.string().min(6, "Credential must be at least 6 characters"),
    fullName: isLogin ? z.string().optional() : z.string().min(2, "Legal name required for provisioning"),
  });

  type AuthFormValues = z.infer<typeof authSchema>;

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
    },
  });

  // Re-trigger validation rules when auth mode changes
  useEffect(() => {
    form.clearErrors();
  }, [isLogin, form]);

  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password
        });
        if (error) throw error;
        toast.success("Welcome back to AetherDesk Prime");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden industrial-grid">

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
                 <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-[0.4em]">PRIME_v2.5_OS</span>
              </div>
            </div>
          </motion.div>
          <div className="flex items-center justify-center gap-4 text-muted-foreground/30 font-mono text-[9px] uppercase tracking-widest italic">
             <span>Protocol_Secure</span>
             <div className="w-1 h-1 bg-white/10 rounded-full" />
             <span>Institutional_Relay</span>
             <div className="w-1 h-1 bg-white/10 rounded-full" />
             <span>Lvl_4_Auth</span>
          </div>
        </div>

        {/* Auth Matrix */}
        <div className="border border-white/5 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-5">
             <Terminal className="w-20 h-20 text-amber-500" aria-hidden="true" />
          </div>

          <div className="flex gap-1 mb-8 bg-black/40 border border-white/5 p-1 rounded-sm" role="tablist" aria-label="Authentication mode">
            <button
              id="auth-tab-login"
              role="tab"
              aria-selected={isLogin}
              aria-controls="auth-form"
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-2 text-[10px] font-black font-mono uppercase tracking-[0.2em] transition-all",
                isLogin ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5"
              )}
            >
              Access_Session
            </button>
            <button
              id="auth-tab-signup"
              role="tab"
              aria-selected={!isLogin}
              aria-controls="auth-form"
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-2 text-[10px] font-black font-mono uppercase tracking-[0.2em] transition-all",
                !isLogin ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5"
              )}
            >
              Initialise_Identity
            </button>
          </div>

          <Form {...form}>
            <form id="auth-form" role="tabpanel" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {!isLogin && (
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Full_Legal_Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                              <Layers className="w-4 h-4" aria-hidden="true" />
                           </div>
                           <Input
                            placeholder="OPERATOR_IDENTITY"
                            autoComplete="name"
                            className="w-full h-auto bg-black/20 border border-white/5 pl-10 pr-3 py-3 text-[11px] font-mono font-bold text-foreground focus-visible:ring-0 focus-visible:border-amber-500/30 focus-visible:bg-amber-500/5 transition-all outline-none rounded-none"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[9px] font-mono uppercase tracking-widest ml-1 text-red-500/80" />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Secure_Endpoint</FormLabel>
                    <FormControl>
                      <div className="relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                            <Terminal className="w-4 h-4" aria-hidden="true" />
                         </div>
                         <Input
                          type="email"
                          placeholder="TRADER@INSTITUTION.DOM"
                          autoComplete="email"
                          className="w-full h-auto bg-black/20 border border-white/5 pl-10 pr-3 py-3 text-[11px] font-mono font-bold text-foreground focus-visible:ring-0 focus-visible:border-amber-500/30 focus-visible:bg-amber-500/5 transition-all outline-none rounded-none"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[9px] font-mono uppercase tracking-widest ml-1 text-red-500/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-center justify-between ml-1 pr-1">
                      <FormLabel className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground/40">Credential_Alpha</FormLabel>
                      {isLogin && (
                        <Link to="/forgot-password" title="Recover Access" className="text-[8px] font-mono font-black uppercase text-amber-500/40 hover:text-amber-500 transition-colors">
                          RECOVERY_PATH
                        </Link>
                      )}
                    </div>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-20">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                         </div>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          className="w-full h-auto bg-black/20 border border-white/5 pl-10 pr-10 py-3 text-[11px] font-mono font-bold text-foreground focus-visible:ring-0 focus-visible:border-amber-500/30 focus-visible:bg-amber-500/5 transition-all outline-none rounded-none"
                          {...field}
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
                    </FormControl>
                    <FormMessage className="text-[9px] font-mono uppercase tracking-widest ml-1 text-red-500/80" />
                  </FormItem>
                )}
              />

              <button
                id="auth-submit"
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-amber-500 hover:bg-white text-black font-black font-mono text-[11px] uppercase tracking-[0.5em] transition-all relative overflow-hidden group disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                {loading ? (
                  <Activity className="w-5 h-5 animate-spin mx-auto" aria-hidden="true" />
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    {isLogin ? "INITIALISE_STATION" : "EXECUTE_PROVISIONING"}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </div>
                )}
              </button>
            </form>
          </Form>

          {/* OAuth Integration */}
          <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
             <div className="flex items-center gap-4 text-[8px] font-mono font-black text-muted-foreground/20 uppercase tracking-widest text-center">
                <div className="flex-1 h-px bg-white/5" />
                SECONDARY_AUTH_BUFFER
                <div className="flex-1 h-px bg-white/5" />
             </div>

             <button
              id="auth-google-signin"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              aria-label="Sign in with Google"
              className="w-full h-11 bg-black/20 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 flex items-center justify-center gap-3 text-[9px] font-mono font-black text-muted-foreground uppercase tracking-widest transition-all group"
            >
              {googleLoading ? (
                <Activity className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                  Link_Institutional_UID
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Audit */}
        <div className="flex items-center justify-center gap-4 mt-12">
          <Shield className="w-3 h-3 text-amber-500/20" />
          <p className="text-[9px] font-mono text-muted-foreground/20 uppercase tracking-[0.2em] italic">
            Secure_Station_Access // AES-256_Encrypted // SOC2_Audit_Pass
          </p>
        </div>
      </motion.div>
    </div>
  );
}
