import { DeleteProductRender } from "@/app/(app)/environments/[environmentId]/product/general/components/DeleteProductRender";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUserProducts } from "@formbricks/lib/product/service";
import { TProduct } from "@formbricks/types/product";

type DeleteProductProps = {
  environmentId: string;
  product: TProduct;
};

export const DeleteProduct = async ({ environmentId, product }: DeleteProductProps) => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const availableProducts = organization ? await getUserProducts(session.user.id, organization.id) : null;

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  if (!membership) {
    throw new Error(t("common.membership_not_found"));
  }
  const organizationRole = membership.organizationRole;
  const { isOwner, isManager } = getAccessFlags(organizationRole);
  const availableProductsLength = availableProducts ? availableProducts.length : 0;
  const isUserManagerOrOwner = isOwner || isManager;
  const isDeleteDisabled = availableProductsLength <= 1 || !isUserManagerOrOwner;

  return (
    <DeleteProductRender
      isDeleteDisabled={isDeleteDisabled}
      isUserManagerOrOwner={isUserManagerOrOwner}
      product={product}
    />
  );
};
