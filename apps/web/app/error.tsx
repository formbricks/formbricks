"use client"; // Error components must be Client components

import { Button } from "@formbricks/ui/Button";
import CodeBlock from "@formbricks/ui/CodeBlock";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  if (process.env.NODE_ENV === "development") {
    console.log(error.message);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent />
      <CodeBlock language={"bash"}>{error.message}</CodeBlock>
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
