"use client";

import { finishProductOnboardingAction } from "@/app/(app)/onboarding/actions";
import Dance from "@/images/onboarding-dance.gif";
import Lost from "@/images/onboarding-lost.gif";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { OnboardingSetupInstructions } from "./OnboardingSetupInstructions";

interface ConnectWithFormbricksProps {
  environment: TEnvironment;
  webAppUrl: string;
  widgetSetupCompleted: boolean;
  channel: TProductConfigChannel;
  industry: TProductConfigIndustry;
}

export const ConnectWithFormbricks = ({
  environment,
  webAppUrl,
  widgetSetupCompleted,
  channel,
  industry,
}: ConnectWithFormbricksProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const handleFinishOnboarding = async () => {
    if (!widgetSetupCompleted) {
      router.push(`/onboarding/${environment.id}/connect/invite?channel=${channel}&industry=${industry}`);
      return;
    }
    try {
      setIsLoading(true);
      await finishProductOnboardingAction(environment.productId, { channel, industry });
      router.push(`/environments/${environment.id}/surveys?channel=${channel}&industry=${industry}`);
    } catch (error) {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 flex w-5/6 flex-col items-center space-y-10 lg:w-2/3 2xl:w-1/2">
      <div className="flex w-full space-x-10">
        <div className="flex w-1/2 flex-col space-y-4">
          <OnboardingSetupInstructions
            environmentId={environment.id}
            webAppUrl={webAppUrl}
            channel={channel}
            widgetSetupCompleted={widgetSetupCompleted}
          />
        </div>
        <div
          className={cn(
            "flex h-[30rem] w-1/2 flex-col items-center justify-center rounded-lg border bg-slate-200 text-center shadow",
            widgetSetupCompleted ? "border-green-500 bg-green-100" : ""
          )}>
          {widgetSetupCompleted ? (
            <div>
              <Image src={Dance} alt="lost" height={250} />
              <p className="mt-6 text-xl font-bold">Connection successful ✅</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Image src={Lost} alt="lost" height={250} />
              <p className="pt-4 text-slate-400">Waiting for your signal...</p>
            </div>
          )}
        </div>
      </div>
      <Button
        id="finishOnboarding"
        variant={widgetSetupCompleted ? "darkCTA" : "minimal"}
        onClick={handleFinishOnboarding}
        loading={isLoading}
        EndIcon={ArrowRight}>
        {widgetSetupCompleted ? "Finish Onboarding" : "Skip"}
      </Button>
    </div>
  );
};
