import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async ({ params }) => {
  const [actionClasses, product, organization] = await Promise.all([
    getActionClasses(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentProductChannel = product?.config.channel ?? null;
  if (currentProductChannel === "link") {
    return notFound();
  }

  const renderAddActionButton = () => (
    <AddActionModal environmentId={params.environmentId} actionClasses={actionClasses} />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Actions" cta={renderAddActionButton()} />
      <ActionClassesTable environmentId={params.environmentId} actionClasses={actionClasses}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </PageContentWrapper>
  );
};

export default Page;
