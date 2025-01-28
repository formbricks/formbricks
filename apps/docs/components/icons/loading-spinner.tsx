import React from "react";

export function LoadingSpinner(props: React.ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex items-center justify-center" {...props}>
      <div className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}

