"use client";

import { useEffect, useState } from "react";

import { Button } from "@formbricks/ui/Button";
import { Confetti } from "@formbricks/ui/Confetti";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

interface ConfirmationPageProps {
  environmentId: string;
}

export default function ConfirmationPage({ environmentId }: ConfirmationPageProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    setShowConfetti(true);
  }, []);
  return (
    <div className="h-full w-full">
      {showConfetti && <Confetti />}
      <ContentWrapper>
        <div className="mx-auto max-w-sm py-8 sm:px-6 lg:px-8">
          <div className="my-6 sm:flex-auto">
            <h1 className="text-center text-xl font-semibold text-slate-900">Upgrade successful</h1>
            <p className="mt-2 text-center text-sm text-slate-700">
              Thanks a lot for upgrading your Formbricks subscription.
            </p>
          </div>
          <Button
            variant="darkCTA"
            className="w-full justify-center"
            href={`/environments/${environmentId}/settings/billing`}>
            Back to billing overview
          </Button>
        </div>
      </ContentWrapper>
    </div>
  );
}
