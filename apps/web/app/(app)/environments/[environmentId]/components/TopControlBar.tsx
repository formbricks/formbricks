"use client";

import { ProjectAndOrgSwitch } from "@/app/(app)/environments/[environmentId]/components/project-and-org-switch";
import { getAccessFlags } from "@/lib/membership/utils";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { BugIcon, CircleUserIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  organization: TOrganization;
  organizations: TOrganization[];
  project: TProject;
  projects: TProject[];
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
  environment,
  environments,
  organization,
  organizations,
  project,
  projects,
  isMultiOrgEnabled,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  membershipRole,
  projectPermission,
}: SideBarProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);
  const isReadOnly = isMember && hasReadAccess;

  const sortedProjects = useMemo(() => projects.sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const sortedOrganizations = useMemo(
    () => organizations.sort((a, b) => a.name.localeCompare(b.name)),
    [organizations]
  );

  return (
    <div
      className="flex h-14 w-full items-center justify-between bg-slate-50 px-6"
      data-testid="fb__global-top-control-bar">
      <div className="flex items-center">
        <ProjectAndOrgSwitch
          currentEnvironment={environment}
          environments={environments}
          currentOrganization={organization}
          organizations={sortedOrganizations}
          currentProject={project}
          projects={sortedProjects}
          isMultiOrgEnabled={isMultiOrgEnabled}
          organizationProjectsLimit={organizationProjectsLimit}
          isFormbricksCloud={isFormbricksCloud}
          isLicenseActive={isLicenseActive}
          isOwnerOrManager={isOwnerOrManager}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      </div>
      <div className="z-50 flex items-center space-x-2">
        <TooltipRenderer tooltipContent={t("common.share_feedback")}>
          <Button variant="ghost" size="icon" className="h-fit w-fit bg-slate-50 p-1" asChild>
            <Link href="https://github.com/formbricks/formbricks/issues" target="_blank">
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
    </div>
  );
};
