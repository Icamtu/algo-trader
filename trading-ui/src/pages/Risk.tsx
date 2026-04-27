import { RiskDashboard } from "@/components/trading/RiskDashboard";

export default function Risk() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-3xl font-black uppercase tracking-[0.1em] text-foreground">Risk_Shield</h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-[0.3em]">
          Kernel_Guardrails // System_Enforcement_Active
        </p>
      </div>

      <RiskDashboard />
    </div>
  );
}
