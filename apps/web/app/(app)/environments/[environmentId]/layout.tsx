import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { AuthorizationError } from "@formbricks/types/errors";
import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnvironmentLayoutData } from "@/modules/environments/lib/utils";
import { EnvironmentIdBaseLayout } from "@/modules/ui/components/environmentId-base-layout";
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

  // Handle AuthorizationError gracefully during rapid navigation
  let layoutData;
  try {
    layoutData = await getEnvironmentLayoutData(params.environmentId, session.user.id);
  } catch (error) {
    // If user doesn't have access, show not found instead of crashing
    if (error instanceof AuthorizationError) {
      return notFound();
    }
    // Re-throw other errors
    throw error;
  }

  return (
    <EnvironmentIdBaseLayout
      environmentId={params.environmentId}
      session={layoutData.session}
      user={layoutData.user}
      organization={layoutData.organization}>
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      <EnvironmentContextWrapper
        environment={layoutData.environment}
        project={layoutData.project}
        organization={layoutData.organization}>
        <EnvironmentLayout layoutData={layoutData}>{children}</EnvironmentLayout>
      </EnvironmentContextWrapper>
    </EnvironmentIdBaseLayout>
  );
};

export default EnvLayout;
