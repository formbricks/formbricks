"use client";

import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

export default function EnvironmentLoading() {
  return (
    <div className="flex h-screen min-h-screen items-center justify-center">
      <LoadingSpinner className="h-8 w-8" />
    </div>
  );
}
