import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";

import EditProductName from "./components/EditProductName";
import EditWaitingTime from "./components/EditWaitingTime";
import DeleteProduct from "./components/DeleteProduct";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const [, product, session, team] = await Promise.all([
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getTeamByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const isProductNameEditDisabled =
    currentUserMembership?.role === "developer" ? true : currentUserMembership?.role === "viewer";

  return (
    <div>
      <SettingsTitle title="Product Settings" />
      <SettingsCard title="Product Name" description="Change your products name.">
        <EditProductName
          environmentId={params.environmentId}
          product={product}
          isProductNameEditDisabled={isProductNameEditDisabled}
        />
      </SettingsCard>
      <SettingsCard
        title="Recontact Waiting Time"
        description="Control how frequently users can be surveyed across all surveys.">
        <EditWaitingTime environmentId={params.environmentId} product={product} />
      </SettingsCard>
      <SettingsCard
        title="Delete Product"
        description="Delete product with all surveys, responses, people, actions and attributes. This cannot be undone.">
        <DeleteProduct environmentId={params.environmentId} product={product} />
      </SettingsCard>
    </div>
  );
}
