import * as React from "react";

export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--color-surface-raised)] ${className}`}
      {...props}
    />
  );
}
