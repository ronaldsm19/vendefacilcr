"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "gradient-bg text-white shadow-lg hover:shadow-brand-pink/40 hover:scale-[1.03] active:scale-[0.98]",
        outline:
          "border-2 border-brand-pink text-brand-pink bg-transparent hover:gradient-bg hover:text-white hover:border-transparent hover:scale-[1.03]",
        ghost:
          "bg-transparent text-brand-dark hover:bg-brand-muted hover:text-brand-pink",
        secondary:
          "bg-brand-muted text-brand-dark hover:bg-brand-pink/10 hover:text-brand-pink",
        whatsapp:
          "bg-[#25D366] text-white shadow-lg hover:bg-[#1ebe5d] hover:scale-[1.03] active:scale-[0.98]",
        link: "text-brand-pink underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-10 w-10 p-0",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
