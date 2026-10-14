import { forwardRef, type HTMLAttributes } from "react";

// shadcn/ui Card anatomy, adapted to evflow's shared semantic tokens.
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-ev border-ev-border bg-ev-card border shadow-sm ${className}`}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`flex flex-col gap-1 p-5 ${className}`} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h2 ref={ref} className={`text-base font-semibold leading-tight ${className}`} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`px-5 pb-5 ${className}`} {...props} />
  ),
);
CardContent.displayName = "CardContent";
