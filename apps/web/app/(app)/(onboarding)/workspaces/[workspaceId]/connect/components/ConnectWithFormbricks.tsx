"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TWorkspaceConfigChannel } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { OnboardingSetupInstructions } from "./OnboardingSetupInstructions";

interface ConnectWithFormbricksProps {
  workspaceId: string;
  publicDomain: string;
  appSetupCompleted: boolean;
  channel: TWorkspaceConfigChannel;
}

export const ConnectWithFormbricks = ({
  workspaceId,
  publicDomain,
  appSetupCompleted,
  channel,
}: ConnectWithFormbricksProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const handleFinishOnboarding = async () => {
    router.push(`/workspaces/${workspaceId}/surveys`);
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
    <div className="mt-6 flex w-5/6 flex-col items-center gap-y-10 lg:w-2/3 2xl:w-1/2">
      <div className="flex w-full gap-x-10">
        <div className="flex w-1/2 flex-col gap-y-4">
          <OnboardingSetupInstructions
            workspaceId={workspaceId}
            publicDomain={publicDomain}
            channel={channel}
            appSetupCompleted={appSetupCompleted}
          />
        </div>
        <div
          className={cn(
            "flex h-[30rem] w-1/2 flex-col items-center justify-center rounded-lg border text-center",
            appSetupCompleted ? "border-green-500 bg-green-100" : "border-slate-300 bg-slate-200"
          )}>
          {appSetupCompleted ? (
            <div>
              <p className="text-3xl">{t("workspace.connect.congrats")}</p>
              <p className="pt-4 text-sm font-medium text-slate-600">
                {t("workspace.connect.connection_successful_message")}
              </p>
            </div>
          ) : (
            <div className="flex animate-pulse flex-col items-center gap-y-4">
              <span className="relative flex size-10">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex size-10 rounded-full bg-slate-500"></span>
              </span>
              <p className="pt-4 text-sm font-medium text-slate-600">
                {t("workspace.connect.waiting_for_your_signal")}
              </p>
            </div>
          )}
        </div>
      </div>
      <Button
        id="finishOnboarding"
        variant={appSetupCompleted ? "default" : "ghost"}
        onClick={handleFinishOnboarding}>
        {appSetupCompleted ? t("workspace.connect.finish_onboarding") : t("workspace.connect.do_it_later")}
        <ArrowRight />
      </Button>
    </div>
  );
};
