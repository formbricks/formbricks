import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

const Layout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslations();
  const [organization, product, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  return <>{children}</>;
};

export default Layout;
