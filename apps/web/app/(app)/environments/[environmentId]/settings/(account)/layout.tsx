import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

const AccountSettingsLayout = async ({ children, params }) => {
  const [organization, product, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!session) {
    throw new Error("Unauthenticated");
  }

  return <>{children}</>;
};

export default AccountSettingsLayout;
