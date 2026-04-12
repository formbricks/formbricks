import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnvironmentLayoutData } from "@/modules/environments/lib/utils";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const layoutData = await getEnvironmentLayoutData(params.environmentId, session.user.id);

  return (
    <>
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      <EnvironmentContextWrapper
        environment={layoutData.environment}
        project={layoutData.project}
        organization={layoutData.organization}>
        {children}
      </EnvironmentContextWrapper>
    </>
  );
};

export default EnvLayout;
