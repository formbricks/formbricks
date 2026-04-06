import { redirect } from "next/navigation";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";

const ConfigLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const { isBilling, workspace } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(`/workspaces/${workspace.id}/settings/billing`);
  }

  return children;
};

export default ConfigLayout;
