import * as React from "react";
import { cn } from "@/lib/utils";

interface AetherPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glint?: boolean;
}

export const AetherPanel = React.forwardRef<HTMLDivElement, AetherPanelProps>(
  ({ className, children, glint = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "aether-panel p-4 shadcn-card", // fallback to shadcn-card if needed
          glint && "industrial-glint",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AetherPanel.displayName = "AetherPanel";
