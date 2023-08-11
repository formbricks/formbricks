import { getServerSession } from "next-auth";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { DeleteProduct } from "./editProduct";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import EditProductName from "./EditProductName";
import EditWaitingTime from "./EditWaitingTime";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const session = await getServerSession(authOptions);
  const product = session ? await getProductByEnvironmentId(params.environmentId) : null;

  if (!product) {
    return null;
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
        <DeleteProduct environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
