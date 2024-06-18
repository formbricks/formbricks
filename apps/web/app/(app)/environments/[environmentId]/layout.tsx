import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { ToasterClient } from "@formbricks/ui/ToasterClient";
import { FormbricksClient } from "../../components/FormbricksClient";
import { PosthogIdentify } from "./components/PosthogIdentify";

const EnvLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }
  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  return (
    <>
      <ResponseFilterProvider>
        <PosthogIdentify
          session={session}
          environmentId={params.environmentId}
          organizationId={organization.id}
          organizationName={organization.name}
          organizationBilling={organization.billing}
        />
        <FormbricksClient session={session} />
        <ToasterClient />
        <EnvironmentLayout environmentId={params.environmentId} session={session}>
          {children}
        </EnvironmentLayout>
      </ResponseFilterProvider>
    </>
  );
};

export default EnvLayout;
