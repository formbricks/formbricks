"use client";

import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { CircleUserIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TopControlButtonsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  membershipRole?: TOrganizationRole;
}

export const TopControlButtons = ({ environment, membershipRole }: TopControlButtonsProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const isReadOnly = isMember;

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
      {isBilling || isReadOnly ? (
        <></>
      ) : (
        <TooltipRenderer tooltipContent={t("common.new_survey")}>
          <Button
            variant="secondary"
            size="icon"
            className="h-fit w-fit p-1"
            onClick={() => {
              router.push(`/environments/${environment.id}/surveys/templates`);
            }}>
            <PlusIcon />
          </Button>
        </TooltipRenderer>
      )}
    </div>
  );
};
