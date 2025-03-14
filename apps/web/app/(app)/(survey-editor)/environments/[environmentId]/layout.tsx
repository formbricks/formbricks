import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { DevEnvironmentBanner } from "@/modules/ui/components/dev-environment-banner";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";
import { IS_POSTHOG_CONFIGURED } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";

const SurveyEditorEnvironmentLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const session = await getServerSession(authOptions);

  if (!session?.user) {
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
    <ResponseFilterProvider>
      <PosthogIdentify
        session={session}
        user={user}
        environmentId={params.environmentId}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationBilling={organization.billing}
        isPosthogEnabled={IS_POSTHOG_CONFIGURED}
      />
      <FormbricksClient userId={user.id} email={user.email} />
      <ToasterClient />
      <div className="flex h-screen flex-col">
        <DevEnvironmentBanner environment={environment} />
        <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
      </div>
    </ResponseFilterProvider>
  );
};

export default SurveyEditorEnvironmentLayout;
