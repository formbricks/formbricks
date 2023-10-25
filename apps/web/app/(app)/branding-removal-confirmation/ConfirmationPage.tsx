"use client";

import { Confetti } from "@formbricks/ui/Confetti";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { Button } from "@formbricks/ui/Button";
import { useEffect, useState } from "react";

export default function BrandingRemovalConfirmationPage() {
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
            <h1 className="text-center text-xl font-semibold text-slate-900">
              Formbricks Branding Removal Plan purchased successfully
            </h1>
            <p className="mt-2 text-center text-sm text-slate-700">
              You will now be able to hide the Formbricks branding on your web-app surveys.
            </p>
          </div>
          <Button variant="darkCTA" className="w-full justify-center" href="/">
            Back to my surveys
          </Button>
        </div>
      </ContentWrapper>
    </div>
  );
}
