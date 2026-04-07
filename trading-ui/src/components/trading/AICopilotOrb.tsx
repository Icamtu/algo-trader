import { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

export function AICopilotOrb() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Orb */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full glow-button flex items-center justify-center animate-float group"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-primary-foreground" />
        ) : (
          <Sparkles className="w-5 h-5 text-primary-foreground transition-transform group-hover:rotate-12" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 glass-panel-elevated rounded-xl overflow-hidden neon-border-cyan">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Aether AI Copilot</span>
            <span className="status-dot-live ml-auto" />
          </div>
          <div className="h-64 p-3 overflow-y-auto space-y-3">
            <div className="glass-panel rounded-lg p-2.5 max-w-[85%]">
              <p className="text-xs text-foreground leading-relaxed">
                Your Momentum Alpha strategy shows a 2.3σ deviation from expected returns. Consider reducing position sizing by 15% during the current high-vol regime.
              </p>
              <span className="text-[9px] text-muted-foreground mt-1 block">2 min ago</span>
            </div>
            <div className="glass-panel rounded-lg p-2.5 max-w-[85%] ml-auto neon-border-purple">
              <p className="text-xs text-foreground leading-relaxed">
                What's the optimal rebalance frequency?
              </p>
            </div>
            <div className="glass-panel rounded-lg p-2.5 max-w-[85%]">
              <p className="text-xs text-foreground leading-relaxed">
                Based on Monte Carlo simulation (10K paths), weekly rebalancing yields Sharpe 2.41 vs daily at 2.34. Transaction costs decrease by 38%.
              </p>
              <span className="text-[9px] text-muted-foreground mt-1 block">Just now</span>
            </div>
          </div>
          <div className="p-2 border-t border-border flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask anything..."
              className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button className="p-1.5 rounded-md bg-primary/20 hover:bg-primary/30 transition-colors">
              <Send className="w-3.5 h-3.5 text-primary" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
