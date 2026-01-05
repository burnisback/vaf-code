import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full h-10 px-3 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] disabled:opacity-50 ${error ? "border-[var(--color-error)]" : ""} ${className}`}
          aria-invalid={error ? "true" : "false"}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
