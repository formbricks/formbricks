import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { SelectPlanOnboarding } from "./components/select-plan-onboarding";

interface PlanPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: PlanPageProps) => {
  const params = await props.params;

  // Only show on Cloud
  if (!IS_FORMBRICKS_CLOUD) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/mode`);
  }

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  return <SelectPlanOnboarding organizationId={params.organizationId} />;
};

export default Page;
