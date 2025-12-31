/**
 * Reusable UI primitive for Chart.
 * Wraps shadcn/Radix patterns and standardizes Tailwind classes.
 */

import * as React from "react";
import { Tooltip, type TooltipProps, ResponsiveContainer } from "recharts";
import { cn } from "../../utils/cn";

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

function ChartContainer({ className, children, ...props }: ChartContainerProps) {
  return (
    <div className={cn("h-[320px] w-full", className)} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltipContent({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartTooltip = (props: TooltipProps<number, string>) => (
  <Tooltip content={<ChartTooltipContent />} {...props} />
);

export { ChartContainer, ChartTooltip, ChartTooltipContent };
