import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldAlert, Shield, Lock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { algoApi } from "@/features/aetherdesk/api/client";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<string, string> = {
  "orders:read":      "View Orders",
  "orders:write":     "Place / Cancel Orders",
  "strategies:read":  "View Strategies",
  "strategies:toggle":"Start / Stop Strategies",
  "telemetry:read":   "Read Telemetry",
  "system:health":    "System Health",
  "brokers:read":     "View Brokers",
  "brokers:write":    "Manage Brokers",
  "alerts:read":      "View Alerts",
  "alerts:write":     "Create / Delete Alerts",
  "webhooks:trigger": "Trigger Webhooks",
  "terminal:execute": "Execute Terminal Commands",
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

const ROLE_COLORS: Record<string, string> = {
  admin:  "text-amber-500 border-amber-500/20 bg-amber-500/5",
  trader: "text-teal-400 border-teal-400/20 bg-teal-400/5",
  viewer: "text-blue-400 border-blue-400/20 bg-blue-400/5",
};

const ROLE_LEVEL: Record<string, string> = {
  admin:  "LVL_4",
  trader: "LVL_2",
  viewer: "LVL_1",
};

export default function Roles() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rbac-matrix"],
    queryFn: () => algoApi.getSystemRbac(),
    staleTime: 60_000,
  });

  const roles: any[] = data?.roles ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      <div className="noise-overlay" />
      <div className="scanline opacity-10" />

      <div className="flex-1 overflow-auto p-8 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between border-b border-border/20 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black font-display uppercase tracking-widest text-foreground">ROLE_AUTHORITY_MATRIX</h1>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Live_RBAC_Permission_Registry</p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 border border-border/20 hover:border-primary/40 text-muted-foreground/40 hover:text-foreground transition-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-primary/30" />
            </div>
          )}

          {isError && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 text-[10px] font-mono text-destructive uppercase">
              Failed to load RBAC matrix from engine.
            </div>
          )}

          {!isLoading && roles.length > 0 && (
            <>
              {/* Role Cards */}
              <div className="grid gap-4">
                {roles.map((role, idx) => {
                  const colorClass = ROLE_COLORS[role.role] ?? "text-foreground border-border/20 bg-card/5";
                  return (
                    <motion.div
                      key={role.role}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={cn("border p-6 relative overflow-hidden", colorClass)}
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-5">
                        <Shield className="w-24 h-24" />
                      </div>
                      <div className="flex items-start justify-between relative z-10 gap-6">
                        <div className="flex items-center gap-6 min-w-[200px]">
                          <div className="text-center">
                            <span className="text-[9px] font-mono font-black opacity-40 uppercase block mb-1">Level</span>
                            <span className="text-xl font-black font-mono">{ROLE_LEVEL[role.role] ?? "LVL_?"}</span>
                          </div>
                          <div className="h-10 w-[1px] bg-white/5" />
                          <div>
                            <h3 className="text-lg font-black font-display uppercase">{role.role}</h3>
                            <span className="text-[9px] font-mono opacity-50 uppercase">
                              {role.is_superuser ? "Full_Access (* wildcard)" : `${role.permissions.length} permissions`}
                            </span>
                          </div>
                        </div>

                        {/* Permission Grid */}
                        <div className="flex-1 grid grid-cols-3 gap-x-6 gap-y-1.5">
                          {ALL_PERMISSIONS.map(perm => {
                            const granted = role.is_superuser || role.permissions.includes(perm);
                            return (
                              <div key={perm} className="flex items-center gap-2">
                                {granted
                                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                  : <XCircle className="w-3 h-3 text-muted-foreground/15 shrink-0" />
                                }
                                <span className={cn(
                                  "text-[9px] font-mono uppercase tracking-wide",
                                  granted ? "text-foreground/70" : "text-muted-foreground/20"
                                )}>
                                  {PERMISSION_LABELS[perm]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer notice */}
              <div className="p-6 bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
                <Lock className="w-5 h-5 text-blue-400 mt-1 shrink-0" />
                <div>
                  <p className="text-[11px] font-mono font-black text-blue-400 uppercase tracking-widest mb-2">Protocol_Notice:</p>
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed uppercase opacity-70">
                    Role assignments are enforced via JWT claims in the engine RBAC middleware.
                    Permission changes require a new signed token — no live escalation possible.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
