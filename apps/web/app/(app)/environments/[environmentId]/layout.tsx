import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { FormbricksClient } from "../../components/FormbricksClient";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";
import { PosthogIdentify } from "./components/PosthogIdentify";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return redirect(`/auth/login`);
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  if (!membership) return notFound();

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
        <FormbricksClient userId={user.id} email={user.email} />
        <ToasterClient />
        <EnvironmentStorageHandler environmentId={params.environmentId} />
        <EnvironmentLayout environmentId={params.environmentId} session={session}>
          {children}
        </EnvironmentLayout>
      </ResponseFilterProvider>
    </>
  );
};

export default EnvLayout;
