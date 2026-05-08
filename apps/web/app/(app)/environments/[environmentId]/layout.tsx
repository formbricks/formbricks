import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { PostHogGroupIdentify } from "@/app/posthog/PostHogGroupIdentify";
import { POSTHOG_KEY } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnvironmentLayoutData } from "@/modules/environments/lib/utils";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  // Check session first (required for userId)
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  // Single consolidated data fetch (replaces ~12 individual fetches)
  const layoutData = await getEnvironmentLayoutData(params.environmentId, session.user.id);

  return (
    <>
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      {POSTHOG_KEY && (
        <PostHogGroupIdentify
          organizationId={layoutData.organization.id}
          organizationName={layoutData.organization.name}
          workspaceId={layoutData.project.id}
          workspaceName={layoutData.project.name}
        />
      )}
      <EnvironmentContextWrapper
        environment={layoutData.environment}
        project={layoutData.project}
        organization={layoutData.organization}>
        <EnvironmentLayout layoutData={layoutData}>{children}</EnvironmentLayout>
      </EnvironmentContextWrapper>
    </>
  );
};

export default EnvLayout;
