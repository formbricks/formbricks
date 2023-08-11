import { getAvailableProducts } from "@formbricks/lib/services/product";
import { getProfile } from "@formbricks/lib/services/profile";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import { getMembersByTeamId } from "@formbricks/lib/services/membership";
import { TProduct } from "@formbricks/types/v1/product";
import DeleteProductRender from "@/app/(app)/environments/[environmentId]/settings/product/DeleteProduct/DeleteProductRender";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

type DeleteProductProps = {
  environmentId: string;
  product: TProduct;
};

export default async function DeleteProduct({ environmentId, product }: DeleteProductProps) {
  const session = await getServerSession(authOptions);

  const profile = session ? await getProfile(session.user.id) : null;
  const team = await getTeamByEnvironmentId(environmentId);

  const availableProducts = team ? await getAvailableProducts(team.id) : null;
  const members = team ? await getMembersByTeamId(team.id) : null;

  const availableProductsLength = availableProducts ? availableProducts.length : 0;
  const role = members ? members.filter((member) => member.userId === profile?.id)[0]?.role : null;
  const isUserAdminOrOwner = role === "admin" || role === "owner";
  const isDeleteDisabled = availableProductsLength <= 1 || !isUserAdminOrOwner;

  return (
    <DeleteProductRender
      isDeleteDisabled={isDeleteDisabled}
      isUserAdminOrOwner={isUserAdminOrOwner}
      product={product}
      environmentId={environmentId}
      userId={session?.user.id ?? ""}
    />
  );
}
