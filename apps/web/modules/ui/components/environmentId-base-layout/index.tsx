import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { IS_POSTHOG_CONFIGURED } from "@/lib/constants";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { Session } from "next-auth";
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
      <ToasterClient />
      {children}
    </ResponseFilterProvider>
  );
};
