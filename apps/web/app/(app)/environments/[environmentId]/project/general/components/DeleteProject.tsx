import { DeleteProjectRender } from "@/app/(app)/environments/[environmentId]/project/general/components/DeleteProjectRender";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUserProjects } from "@formbricks/lib/project/service";
import { TProject } from "@formbricks/types/project";

type DeleteProductProps = {
  environmentId: string;
  product: TProject;
  isOwnerOrManager: boolean;
};

export const DeleteProduct = async ({ environmentId, product, isOwnerOrManager }: DeleteProductProps) => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const availableProducts = organization ? await getUserProjects(session.user.id, organization.id) : null;

  const availableProductsLength = availableProducts ? availableProducts.length : 0;
  const isDeleteDisabled = availableProductsLength <= 1 || !isOwnerOrManager;

  return (
    <DeleteProjectRender
      isDeleteDisabled={isDeleteDisabled}
      isOwnerOrManager={isOwnerOrManager}
      project={product}
    />
  );
};
