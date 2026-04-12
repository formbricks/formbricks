import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnvironmentLayoutData } from "@/modules/environments/lib/utils";

const MainNavLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirect("/auth/login");
  }

  const layoutData = await getEnvironmentLayoutData(params.environmentId, session.user.id);

  return <EnvironmentLayout layoutData={layoutData}>{children}</EnvironmentLayout>;
};

export default MainNavLayout;
