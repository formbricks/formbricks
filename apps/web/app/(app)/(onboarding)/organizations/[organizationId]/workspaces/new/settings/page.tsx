import { XIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TWorkspaceConfigChannel,
  TWorkspaceConfigIndustry,
  TWorkspaceMode,
} from "@formbricks/types/workspace";
import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { WorkspaceSettings } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/settings/components/WorkspaceSettings";
import { DEFAULT_BRAND_COLOR } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";

interface WorkspaceSettingsPageProps {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    channel?: TWorkspaceConfigChannel;
    industry?: TWorkspaceConfigIndustry;
    mode?: TWorkspaceMode;
  }>;
}

const Page = async (props: WorkspaceSettingsPageProps) => {
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
  const workspaces = await getUserWorkspaces(session.user.id, params.organizationId);

  const organizationTeams = await getTeamsByOrganizationId(params.organizationId);

  const isAccessControlAllowed = await getAccessControlPermission(organization.id);

  if (!organizationTeams) {
    throw new ResourceNotFoundError(t("common.team"), null);
  }

  const publicDomain = getPublicDomain();

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.workspaces.new.settings.workspace_settings_title")}
        subtitle={t("organizations.workspaces.new.settings.workspace_settings_subtitle")}
      />
      <WorkspaceSettings
        organizationId={params.organizationId}
        workspaceMode={mode}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
        organizationTeams={organizationTeams}
        isAccessControlAllowed={isAccessControlAllowed}
        userWorkspacesCount={workspaces.length}
        publicDomain={publicDomain}
      />
      {workspaces.length >= 1 && (
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
