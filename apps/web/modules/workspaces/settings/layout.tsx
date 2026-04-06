import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";

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
      return redirect(`/workspaces/${params.workspaceId}/settings/billing`);
    }

    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
