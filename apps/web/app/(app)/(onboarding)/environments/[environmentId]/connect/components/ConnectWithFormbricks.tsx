"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { OnboardingSetupInstructions } from "./OnboardingSetupInstructions";

interface ConnectWithFormbricksProps {
  environment: TEnvironment;
  webAppUrl: string;
  widgetSetupCompleted: boolean;
  channel: TProjectConfigChannel;
}

export const ConnectWithFormbricks = ({
  environment,
  webAppUrl,
  widgetSetupCompleted,
  channel,
}: ConnectWithFormbricksProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const handleFinishOnboarding = async () => {
    router.push(`/environments/${environment.id}/surveys`);
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
            "flex h-[30rem] w-1/2 flex-col items-center justify-center rounded-lg border text-center",
            widgetSetupCompleted ? "border-green-500 bg-green-100" : "border-slate-300 bg-slate-200"
          )}>
          {widgetSetupCompleted ? (
            <div>
              <p className="text-3xl">{t("environments.connect.congrats")}</p>
              <p className="pt-4 text-sm font-medium text-slate-600">
                {t("environments.connect.connection_successful_message")}
              </p>
            </div>
          ) : (
            <div className="flex animate-pulse flex-col items-center space-y-4">
              <span className="relative flex h-10 w-10">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex h-10 w-10 rounded-full bg-slate-500"></span>
              </span>
              <p className="pt-4 text-sm font-medium text-slate-600">
                {t("environments.connect.waiting_for_your_signal")}
              </p>
            </div>
          )}
        </div>
      </div>
      <Button
        id="finishOnboarding"
        variant={widgetSetupCompleted ? "default" : "ghost"}
        onClick={handleFinishOnboarding}>
        {widgetSetupCompleted
          ? t("environments.connect.finish_onboarding")
          : t("environments.connect.do_it_later")}
        <ArrowRight />
      </Button>
    </div>
  );
};
