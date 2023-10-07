import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";

import EditProductName from "./EditProductName";
import EditWaitingTime from "./EditWaitingTime";
import DeleteProduct from "./DeleteProduct";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const [, product] = await Promise.all([
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  return (
    <div>
      <SettingsTitle title="Product Settings" />
      <SettingsCard title="Product Name" description="Change your products name.">
        <EditProductName environmentId={params.environmentId} product={product} />
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
