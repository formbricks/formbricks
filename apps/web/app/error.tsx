"use client"; // Error components must be Client components

import { Button, ErrorComponent } from "@/../../packages/ui";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent />
      <Button
        variant="secondary"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className="mt-2">
        Try again
      </Button>
    </div>
  );
}
