import { XIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TProjectConfigChannel, TProjectConfigIndustry, TProjectMode } from "@formbricks/types/project";
import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { ProjectSettings } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/settings/components/ProjectSettings";
import { DEFAULT_BRAND_COLOR } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { capturePostHogEvent } from "@/lib/posthog";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getUserProjects } from "@/lib/project/service";
import { buildStylingFromBrandColor } from "@/lib/styling/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { createProject } from "@/modules/projects/settings/lib/project";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";

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

  const experimentVariant =
    (await getPostHogFeatureFlag(session.user.id, "onboarding-theme-experiment")) || "control";

  if (experimentVariant === "remove-theme") {
    const project = await createProject(params.organizationId, {
      name: organization.name,
      styling: buildStylingFromBrandColor(DEFAULT_BRAND_COLOR),
      config: { channel, industry },
    });
    const productionEnv = project.environments.find((e) => e.type === "production");
    if (channel === "app" || channel === "website") {
      return redirect(`/environments/${productionEnv?.id}/connect`);
    } else if (channel === "link") {
      return redirect(`/environments/${productionEnv?.id}/surveys`);
    }
    return redirect(`/environments/${productionEnv?.id}/xm-templates`);
  }

  const projects = await getUserProjects(session.user.id, params.organizationId);

  const organizationTeams = await getTeamsByOrganizationId(params.organizationId);

  const isAccessControlAllowed = await getAccessControlPermission(organization.id);

  if (!organizationTeams) {
    throw new ResourceNotFoundError(t("common.team"), null);
  }

  const publicDomain = getPublicDomain();

  if (searchParams.mode === "cx") {
    capturePostHogEvent(
      session.user.id,
      "organization_mode_selected",
      {
        organization_id: params.organizationId,
        mode: "cx",
      },
      { organizationId: params.organizationId }
    );
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.workspaces.new.settings.workspace_settings_title")}
        subtitle={t("organizations.workspaces.new.settings.workspace_settings_subtitle")}
      />
      <ProjectSettings
        organizationId={params.organizationId}
        projectMode={mode}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
        organizationTeams={organizationTeams}
        isAccessControlAllowed={isAccessControlAllowed}
        userProjectsCount={projects.length}
        publicDomain={publicDomain}
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
