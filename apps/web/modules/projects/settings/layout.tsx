import { Metadata } from "next";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";

export const metadata: Metadata = {
  title: "Configuration",
};

export const ProjectSettingsLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  // Use the new utility to get all required data with authorization checks
  const { isBilling } = await getEnvironmentAuth(params.environmentId);

  // Redirect billing users
  if (isBilling) {
    return redirect(getBillingFallbackPath(params.environmentId, IS_FORMBRICKS_CLOUD));
  }

  return children;
};
