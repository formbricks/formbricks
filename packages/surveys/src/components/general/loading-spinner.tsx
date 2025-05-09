import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md";
}
export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: "w-9 h-5 m-0",
    md: "h-6 w-6 m-2",
  };

  return (
    <div
      data-testid="loading-spinner"
      className={cn("flex h-full w-full items-center justify-center", className ?? "")}>
      <svg
        className={cn("text-brand animate-spin", sizeStyles[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
