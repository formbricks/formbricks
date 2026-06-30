import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const ConfigLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const { isBilling, organization } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  return children;
};

export default ConfigLayout;
