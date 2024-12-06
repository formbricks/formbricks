import React from "react";

export const LoadingSpinner = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
  </div>
);
