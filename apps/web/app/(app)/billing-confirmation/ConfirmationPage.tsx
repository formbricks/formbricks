"use client";

import ContentWrapper from "@/components/shared/ContentWrapper";
import { Button, Confetti } from "@formbricks/ui";
import { useEffect, useState } from "react";

export default function ConfirmationPage() {
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
              Thanks a lot for upgrading your formbricks subscription. You can now access all features and
              improve your user research.
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
