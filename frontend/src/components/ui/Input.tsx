import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    const inputStyles = [
      "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm",
      "placeholder:text-zinc-500",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "dark:bg-zinc-950 dark:focus-visible:ring-zinc-300",
      error
        ? "border-red-500 focus-visible:ring-red-500"
        : "border-zinc-300 dark:border-zinc-700",
      className,
    ].join(" ");

    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium">{label}</label>
        )}
        <input ref={ref} className={inputStyles} {...props} />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
