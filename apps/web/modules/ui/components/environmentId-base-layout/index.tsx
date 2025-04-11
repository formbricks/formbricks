import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { Session } from "next-auth";
import {
  FORMBRICKS_API_HOST,
  FORMBRICKS_ENVIRONMENT_ID,
  IS_FORMBRICKS_ENABLED,
  IS_POSTHOG_CONFIGURED,
} from "@formbricks/lib/constants";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

interface EnvironmentIdBaseLayoutProps {
  children: React.ReactNode;
  environmentId: string;
  session: Session;
  user: TUser;
  organization: TOrganization;
}

export const EnvironmentIdBaseLayout = async ({
  children,
  environmentId,
  session,
  user,
  organization,
}: EnvironmentIdBaseLayoutProps) => {
  return (
    <ResponseFilterProvider>
      <PosthogIdentify
        session={session}
        user={user}
        environmentId={environmentId}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationBilling={organization.billing}
        isPosthogEnabled={IS_POSTHOG_CONFIGURED}
      />
      <FormbricksClient
        userId={user.id}
        email={user.email}
        formbricksApiHost={FORMBRICKS_API_HOST}
        formbricksEnvironmentId={FORMBRICKS_ENVIRONMENT_ID}
        formbricksEnabled={IS_FORMBRICKS_ENABLED}
      />
      <ToasterClient />
      {children}
    </ResponseFilterProvider>
  );
};
