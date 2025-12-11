import * as React from "react";

interface AlertCircleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * AlertCircle icon - a simple SVG implementation that works with both React and Preact.
 * This replaces lucide-react's AlertCircle to avoid React 19 internals incompatibility with Preact.
 */
function AlertCircleIcon({ className, ...props }: AlertCircleIconProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export { AlertCircleIcon };
