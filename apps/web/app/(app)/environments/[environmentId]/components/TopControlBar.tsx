"use client";

import { ProjectAndOrgSwitch } from "@/app/(app)/environments/[environmentId]/components/project-and-org-switch";
import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { getAccessFlags } from "@/lib/membership/utils";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { BugIcon, CircleUserIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TopControlBarProps {
  environments: TEnvironment[];
  currentOrganizationId: string;
  organizations: { id: string; name: string }[];
  currentProjectId: string;
  projects: { id: string; name: string }[];
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  membershipRole?: TOrganizationRole;
  projectPermission: TTeamPermission | null;
}

export const TopControlBar = ({
  environments,
  currentOrganizationId,
  organizations,
  currentProjectId,
  projects,
  isMultiOrgEnabled,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  membershipRole,
  projectPermission,
}: TopControlBarProps) => {
  const { t } = useTranslate();

  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);
  const isReadOnly = isMember && hasReadAccess;
  const { environment } = useEnvironment();

  return (
    <div
      className="flex h-14 w-full items-center justify-between bg-slate-50 px-6"
      data-testid="fb__global-top-control-bar">
      <div className="flex items-center">
        <ProjectAndOrgSwitch
          currentEnvironmentId={environment.id}
          environments={environments}
          currentOrganizationId={currentOrganizationId}
          organizations={organizations}
          currentProjectId={currentProjectId}
          projects={projects}
          isMultiOrgEnabled={isMultiOrgEnabled}
          organizationProjectsLimit={organizationProjectsLimit}
          isFormbricksCloud={isFormbricksCloud}
          isLicenseActive={isLicenseActive}
          isOwnerOrManager={isOwnerOrManager}
          isMember={isMember}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      </div>
      <div className="z-50 flex items-center space-x-2">
        <TooltipRenderer tooltipContent={t("common.share_feedback")}>
          <Button variant="ghost" size="icon" className="h-fit w-fit bg-slate-50 p-1" asChild>
            <Link
              href="https://github.com/formbricks/formbricks/issues"
              target="_blank"
              aria-label={t("common.share_feedback")}
              rel="noopener noreferrer">
              <BugIcon />
            </Link>
          </Button>
        </TooltipRenderer>

        <TooltipRenderer tooltipContent={t("common.account")}>
          <Button variant="ghost" size="icon" className="h-fit w-fit bg-slate-50 p-1" asChild>
            <Link href={`/environments/${environment.id}/settings/profile`} aria-label={t("common.account")}>
              <CircleUserIcon />
            </Link>
          </Button>
        </TooltipRenderer>
        {isBilling || isReadOnly ? (
          <></>
        ) : (
          <TooltipRenderer tooltipContent={t("common.new_survey")}>
            <Button variant="secondary" size="icon" className="h-fit w-fit p-1" asChild>
              <Link
                href={`/environments/${environment.id}/surveys/templates`}
                aria-label={t("common.new_survey")}>
                <PlusIcon />
              </Link>
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
