import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // One amber action per screen; everything else stays a hairline.
        default:
          "bg-accent font-semibold text-accent-ink hover:brightness-[1.06] active:brightness-95",
        outline:
          "border border-line-strong text-fg hover:bg-hover hover:border-line-strong",
        secondary: "bg-surface-inset text-fg hover:bg-hover",
        ghost: "text-fg-muted hover:bg-hover hover:text-fg",
        destructive:
          "border border-clay-line text-clay-text hover:bg-clay-soft",
        link: "h-auto rounded-none px-0 text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 rounded-[9px] px-3 text-xs",
        lg: "h-[42px] px-5 text-sm",
        icon: "h-[38px] w-[38px] px-0",
        "icon-sm": "h-8 w-8 rounded-[9px] px-0",
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
