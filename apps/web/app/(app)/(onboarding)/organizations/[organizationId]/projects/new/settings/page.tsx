import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { ProjectSettings } from "@/app/(app)/(onboarding)/organizations/[organizationId]/projects/new/settings/components/ProjectSettings";
import { DEFAULT_BRAND_COLOR } from "@/lib/constants";
import { getUserProjects } from "@/lib/project/service";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TProjectConfigChannel, TProjectConfigIndustry, TProjectMode } from "@formbricks/types/project";

interface ProjectSettingsPageProps {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    channel?: TProjectConfigChannel;
    industry?: TProjectConfigIndustry;
    mode?: TProjectMode;
  }>;
}

const Page = async (props: ProjectSettingsPageProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslate();

  const { session, organization } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const channel = searchParams.channel ?? null;
  const industry = searchParams.industry ?? null;
  const mode = searchParams.mode ?? "surveys";
  const projects = await getUserProjects(session.user.id, params.organizationId);

  const organizationTeams = await getTeamsByOrganizationId(params.organizationId);

  const canDoRoleManagement = await getRoleManagementPermission(organization.billing.plan);

  if (!organizationTeams) {
    throw new Error(t("common.organization_teams_not_found"));
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.projects.new.settings.project_settings_title")}
        subtitle={t("organizations.projects.new.settings.project_settings_subtitle")}
      />
      <ProjectSettings
        organizationId={params.organizationId}
        projectMode={mode}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
        organizationTeams={organizationTeams}
        canDoRoleManagement={canDoRoleManagement}
        userProjectsCount={projects.length}
      />
      {projects.length >= 1 && (
        <Button
          className="absolute top-5 right-5 mt-0! text-slate-500 hover:text-slate-700"
          variant="ghost"
          asChild>
          <Link href={"/"}>
            <XIcon className="h-7 w-7" strokeWidth={1.5} />
          </Link>
        </Button>
      )}
    </div>
  );
};

export default Page;
