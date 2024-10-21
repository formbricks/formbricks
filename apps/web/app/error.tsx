"use client";

// Error components must be Client components
import { Button } from "@formbricks/ui/components/Button";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { useSession } from "next-auth/react";

const Error = ({ error, reset }: { error: Error; reset: () => void }) => {
  const { data: session } = useSession();

  if (process.env.NODE_ENV === "development") {
    console.error(error.message);
  }

  const handleGoToDashboard = () => {
    if (session) {
      window.location.href = "/";
    } else {
      window.location.href = "/auth/login";
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent />
      <div className="mt-2">
        <Button variant="secondary" onClick={() => reset()} className="mr-2">
          Try again
        </Button>
        <Button onClick={handleGoToDashboard}>Go to Dashboard</Button>
      </div>
    </div>
  );
};

export default Error;