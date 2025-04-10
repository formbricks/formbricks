"use client";

import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { CircleUserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { TEnvironment } from "@formbricks/types/environment";

interface TopControlButtonsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export const TopControlButtons = ({ environment }: TopControlButtonsProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  return (
    <div className="z-50 flex items-center space-x-2">
      {/* {!isBilling && <EnvironmentSwitch environment={environment} environments={environments} />} */}

      {/* <TooltipRenderer tooltipContent={t("common.share_feedback")}>
        <Button variant="ghost" size="icon" className="h-fit w-fit bg-slate-50 p-1" asChild>
          <Link href="https://github.com/formbricks/formbricks/issues" target="_blank">
            <BugIcon />
          </Link>
        </Button>
      </TooltipRenderer> */}

      <TooltipRenderer tooltipContent={t("common.account")}>
        <Button
          variant="ghost"
          size="icon"
          className="h-fit w-fit bg-slate-50 p-1"
          onClick={() => {
            router.push(`/environments/${environment.id}/settings/profile`);
          }}>
          <CircleUserIcon />
        </Button>
      </TooltipRenderer>
    </div>
  );
};
