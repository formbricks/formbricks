import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Configuration",
};

export const ProjectSettingsLayout = async (props) => {
  const params = await props.params;
  const { children } = props;

  try {
    // Use the new utility to get all required data with authorization checks
    const { isBilling } = await getEnvironmentAuth(params.environmentId);

    // Redirect billing users
    if (isBilling) {
      return redirect(`/environments/${params.environmentId}/settings/billing`);
    }

    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
