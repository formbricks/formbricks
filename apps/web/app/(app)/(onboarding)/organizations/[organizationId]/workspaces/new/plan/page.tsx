import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { SelectPlanOnboarding } from "./components/select-plan-onboarding";

interface PlanPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: PlanPageProps) => {
  const params = await props.params;

  if (!IS_FORMBRICKS_CLOUD) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/mode`);
  }

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  return <SelectPlanOnboarding organizationId={params.organizationId} />;
};

export default Page;
