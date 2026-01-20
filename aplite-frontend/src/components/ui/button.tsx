/**
 * Reusable UI primitive for Button.
 * Wraps shadcn/Radix patterns and standardizes Tailwind classes.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border border-input bg-background shadow-sm hover:bg-secondary hover:text-secondary-foreground hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-primary text-primary-foreground shadow-md hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 hover:-translate-y-0.5 active:translate-y-0",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90 hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const content = isLoading ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{loadingText || "Working..."}</span>
      </>
    ) : (
      children
    );
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
