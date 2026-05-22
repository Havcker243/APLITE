/**
 * Reusable UI primitive for Resizable.
 * Wraps shadcn/Radix patterns and standardizes Tailwind classes.
 */

import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "../../utils/cn";

const ResizablePanelGroup = ResizablePrimitive.PanelGroup;

const ResizablePanel = ResizablePrimitive.Panel;

type ResizableHandleProps = React.ComponentPropsWithoutRef<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
};

const ResizableHandle = ({ className, withHandle, ...props }: ResizableHandleProps) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border transition-colors hover:bg-primary/50 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border bg-background">
        <div className="h-2 w-1 rounded-full bg-border" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);
ResizableHandle.displayName = "ResizableHandle";

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
