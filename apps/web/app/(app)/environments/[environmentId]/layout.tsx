import { redirect } from "next/navigation";
import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { getEnvironmentLayoutData } from "@/modules/environments/lib/utils";
import { EnvironmentIdBaseLayout } from "@/modules/ui/components/environmentId-base-layout";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  // Single consolidated data fetch (replaces ~12 individual fetches)
  const layoutData = await getEnvironmentLayoutData(params.environmentId);

  if (!layoutData.session) {
    return redirect(`/auth/login`);
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
