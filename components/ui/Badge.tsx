import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function Badge({ variant = "default", className = "", ...props }: BadgeProps) {
  const variants = {
    default: "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]",
    success: "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20",
    warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20",
    error: "bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20",
    info: "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
