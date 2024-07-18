import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import packageJson from "@/package.json";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SettingsId } from "@formbricks/ui/SettingsId";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { DeleteProduct } from "./components/DeleteProduct";
import { EditProductNameForm } from "./components/EditProductNameForm";
import { EditWaitingTimeForm } from "./components/EditWaitingTimeForm";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const [product, session, organization] = await Promise.all([
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isDeveloper, isViewer } = getAccessFlags(currentUserMembership?.role);
  const isProductNameEditDisabled = isDeveloper ? true : isViewer;

  if (isViewer) {
    return <ErrorComponent />;
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const currentProductChannel = product?.config.channel ?? null;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="general"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          productChannel={currentProductChannel}
        />
      </PageHeader>

      <SettingsCard title="Product Name" description="Change your products name.">
        <EditProductNameForm product={product} isProductNameEditDisabled={isProductNameEditDisabled} />
      </SettingsCard>
      {currentProductChannel !== "link" && (
        <SettingsCard
          title="Recontact Waiting Time"
          description="Control how frequently users can be surveyed across all surveys.">
          <EditWaitingTimeForm product={product} />
        </SettingsCard>
      )}
      <SettingsCard
        title="Delete Product"
        description="Delete product with all surveys, responses, people, actions and attributes. This cannot be undone.">
        <DeleteProduct environmentId={params.environmentId} product={product} />
      </SettingsCard>
      <div>
        <SettingsId title="Product ID" id={product.id}></SettingsId>
        {!IS_FORMBRICKS_CLOUD && (
          <SettingsId title="Formbricks version" id={packageJson.version}></SettingsId>
        )}
      </div>
    </PageContentWrapper>
  );
};

export default Page;
