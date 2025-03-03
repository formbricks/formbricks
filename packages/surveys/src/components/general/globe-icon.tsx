interface GlobeIconProps {
  className?: string;
}

export function GlobeIcon({ className }: GlobeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`lucide lucide-globe ${className ? className.toString() : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
