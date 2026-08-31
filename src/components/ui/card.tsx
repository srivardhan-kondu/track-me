import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-[20px] border", {
  variants: {
    tone: {
      /** The default panel: a filled step up from the page's black. */
      default: "border-line bg-surface text-fg",
      /** Carries no fill — for secondary figures that should recede. */
      quiet: "border-line bg-transparent text-fg",
      /** A step down: rows that have already been read. */
      muted: "border-line bg-surface-muted text-fg",
      /** The one card on a screen that carries the accent. */
      accent: "border-accent-line bg-accent-soft text-fg",
      /** The hero panel — a violet gradient rather than a flat fill. */
      hero: "accent-gradient accent-glow border-transparent text-fg",
      /** Anything from the coach. */
      sage: "border-sage-line bg-sage-soft text-fg",
      /** Something to attend to, never alarming. */
      clay: "border-clay-line bg-clay-soft text-fg",
      /** Nothing here yet, but something will be. */
      dashed: "border-dashed border-line-strong bg-transparent text-fg",
    },
  },
  defaultVariants: { tone: "default" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ tone }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5 pb-3", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[13px] font-semibold leading-none text-fg", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[12.5px] leading-relaxed text-fg-dim", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
