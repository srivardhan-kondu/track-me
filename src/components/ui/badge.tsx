import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-accent-line/70 bg-accent-soft text-accent-text",
        secondary: "border-line bg-surface-inset text-fg-muted",
        outline: "border-line-strong bg-transparent text-fg-muted",
        success: "border-sage-line bg-sage-soft text-sage-text",
        warning: "border-clay-line/70 bg-clay-soft text-clay-text",
        destructive: "border-clay-line bg-clay-soft text-clay-text",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
