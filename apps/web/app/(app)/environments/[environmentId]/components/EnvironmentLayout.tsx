import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import { DevEnvironmentBanner } from "@/modules/ui/components/dev-environment-banner";
import { getTranslate } from "@/tolgee/server";
import type { Session } from "next-auth";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import {
  getOrganizationByEnvironmentId,
  getOrganizationsByUserId,
} from "@formbricks/lib/organization/service";
import { getProjects } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
  hasAccess: boolean;
}

export const EnvironmentLayout = async ({
  environmentId,
  session,
  children,
  hasAccess,
}: EnvironmentLayoutProps) => {
  const t = await getTranslate();
  const [user, environment, organizations, organization] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getOrganizationsByUserId(session.user.id),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const [projects, environments] = await Promise.all([
    getProjects(organization.id),
    getEnvironments(environment.projectId),
  ]);

  if (!projects || !environments || !organizations) {
    throw new Error(t("environments.projects_environments_organizations_not_found"));
  }

  const isMultiOrgEnabled = false;

  const organizationProjectsLimit = 10;

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <DevEnvironmentBanner environment={environment} />

      <div className="flex h-full">
        <MainNavigation
          hasAccess={hasAccess}
          environment={environment}
          organization={organization}
          organizations={organizations}
          projects={projects}
          organizationProjectsLimit={organizationProjectsLimit}
          user={user}
          isMultiOrgEnabled={isMultiOrgEnabled}
        />
        <div id="mainContent" className="flex-1 overflow-y-auto bg-slate-50">
          <TopControlBar environment={environment} environments={environments} />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
