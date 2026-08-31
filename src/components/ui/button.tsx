import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[13.5px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // One violet action per screen, lifted off the page; the rest are flat.
        default:
          "accent-glow bg-accent text-accent-ink hover:bg-accent-strong active:brightness-95",
        outline:
          "border border-line-strong text-fg hover:border-accent-line hover:bg-hover",
        secondary: "bg-surface-inset text-fg hover:bg-hover",
        ghost: "font-medium text-fg-muted hover:bg-hover hover:text-fg",
        destructive:
          "border border-clay-line text-clay-text hover:bg-clay-soft",
        link: "h-auto rounded-none px-0 font-medium text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[42px] px-5",
        sm: "h-8 rounded-[10px] px-3.5 text-xs",
        lg: "h-[50px] px-6 text-[14.5px]",
        icon: "h-[42px] w-[42px] rounded-full px-0",
        "icon-sm": "h-8 w-8 rounded-full px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
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
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
