import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { DevEnvironmentBanner } from "@formbricks/ui/components/DevEnvironmentBanner";
import { ToasterClient } from "@formbricks/ui/components/ToasterClient";

const SurveyEditorEnvironmentLayout = async ({ children, params }) => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  return (
    <>
      <ResponseFilterProvider>
        <PosthogIdentify
          session={session}
          user={user}
          environmentId={params.environmentId}
          organizationId={organization.id}
          organizationName={organization.name}
          organizationBilling={organization.billing}
        />
        <FormbricksClient session={session} userEmail={user.email} />
        <ToasterClient />
        <div className="flex h-screen flex-col">
          <DevEnvironmentBanner environment={environment} />
          <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
        </div>
      </ResponseFilterProvider>
    </>
  );
};

export default SurveyEditorEnvironmentLayout;
