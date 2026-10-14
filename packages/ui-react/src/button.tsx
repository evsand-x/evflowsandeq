import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

const variants = {
  default: "bg-ev-primary text-white hover:bg-ev-primary-dark",
  outline: "border border-ev-border bg-ev-card text-ev-text hover:bg-ev-primary-soft",
  ghost: "text-ev-text hover:bg-ev-primary-soft",
} as const;

export function Button({
  className = "",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-ev-control focus:ring-ev-primary inline-flex min-h-11 cursor-pointer items-center justify-center px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
