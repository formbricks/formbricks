import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslations();
  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    throw new Error(t("common.not_authorized"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  return <>{children}</>;
};

export default BillingLayout;
