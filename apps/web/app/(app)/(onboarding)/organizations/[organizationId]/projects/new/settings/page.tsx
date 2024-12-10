import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { getCustomHeadline } from "@/app/(app)/(onboarding)/lib/utils";
import { ProjectSettings } from "@/app/(app)/(onboarding)/organizations/[organizationId]/projects/new/settings/components/ProjectSettings";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DEFAULT_BRAND_COLOR, DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getUserProjects } from "@formbricks/lib/project/service";
import { getUserLocale } from "@formbricks/lib/user/service";
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
  const t = await getTranslations();
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const channel = searchParams.channel || null;
  const industry = searchParams.industry || null;
  const mode = searchParams.mode || "surveys";
  const locale = session?.user.id ? await getUserLocale(session.user.id) : undefined;
  const customHeadline = getCustomHeadline(channel);
  const projects = await getUserProjects(session.user.id, params.organizationId);

  const organizationTeams = await getTeamsByOrganizationId(params.organizationId);

  const organization = await getOrganization(params.organizationId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  if (!organizationTeams) {
    throw new Error(t("common.organization_teams_not_found"));
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      {channel === "link" || mode === "cx" ? (
        <Header
          title={t("organizations.projects.new.settings.channel_settings_title")}
          subtitle={t("organizations.projects.new.settings.channel_settings_subtitle")}
        />
      ) : (
        <Header
          title={t(customHeadline)}
          subtitle={t("organizations.projects.new.settings.channel_settings_description")}
        />
      )}
      <ProjectSettings
        organizationId={params.organizationId}
        projectMode={mode}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
        organizationTeams={organizationTeams}
        canDoRoleManagement={canDoRoleManagement}
        locale={locale ?? DEFAULT_LOCALE}
      />
      {projects.length >= 1 && (
        <Button
          className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
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
