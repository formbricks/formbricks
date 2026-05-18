import { Metadata } from "next";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const metadata: Metadata = {
  title: "Configuration",
};

export const WorkspaceSettingsLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  try {
    const { isBilling } = await getWorkspaceAuth(params.workspaceId);

    if (isBilling) {
      return redirect(getBillingFallbackPath(params.workspaceId, IS_FORMBRICKS_CLOUD));
    }

    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
