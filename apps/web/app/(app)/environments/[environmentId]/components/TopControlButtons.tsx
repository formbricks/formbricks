"use client";

import { EnvironmentSwitch } from "@/app/(app)/environments/[environmentId]/components/EnvironmentSwitch";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { BugIcon, CircleUserIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TopControlButtonsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  membershipRole?: TOrganizationRole;
  projectPermission: TTeamPermission | null;
}

export const TopControlButtons = ({
  environment,
  environments,
  membershipRole,
  projectPermission,
}: TopControlButtonsProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);
  const isReadOnly = isMember && hasReadAccess;

  return (
    <div className="z-50 flex items-center space-x-2">
      {!isBilling && <EnvironmentSwitch environment={environment} environments={environments} />}

      <TooltipRenderer tooltipContent={t("common.share_feedback")}>
        <Button variant="ghost" size="icon" className="h-fit w-fit bg-slate-50 p-1" asChild>
          <Link href="https://github.com/formbricks/formbricks/issues/new/choose" target="_blank">
            <BugIcon />
          </Link>
        </Button>
      </TooltipRenderer>

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
