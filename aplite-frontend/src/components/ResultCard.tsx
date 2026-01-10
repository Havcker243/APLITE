/**
 * Card layout for presenting resolved account data.
 * Provides consistent styling for result summaries.
 */

import { ReactNode } from "react";
import { cn } from "../utils/cn";

interface ResultCardProps {
  variant?: "success" | "error" | "info";
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}

const variantStyles = {
  success: "bg-success/5 border-success/20",
  error: "bg-destructive/5 border-destructive/20",
  info: "bg-card border-border",
};

const ResultCard = ({ variant = "info", icon, title, children, className }: ResultCardProps) => {
  /** Card wrapper for result/status messaging. */
  return (
    <div className={cn("rounded-xl border p-6 animate-fade-in", variantStyles[variant], className)}>
      {(icon || title) && (
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <span className="font-semibold text-foreground">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
};

export default ResultCard;
