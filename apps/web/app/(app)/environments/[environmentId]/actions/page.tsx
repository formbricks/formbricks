import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);
  const t = await getTranslations();
  const [actionClasses, organization] = await Promise.all([
    getActionClasses(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);
  const locale = await findMatchingLocale();

  if (!session) {
    throw new Error("Session not found");
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.organizationRole);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const renderAddActionButton = () => (
    <AddActionModal environmentId={params.environmentId} actionClasses={actionClasses} />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.actions")} cta={renderAddActionButton()} />
      <ActionClassesTable environmentId={params.environmentId} actionClasses={actionClasses}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} locale={locale} />
        ))}
      </ActionClassesTable>
    </PageContentWrapper>
  );
};

export default Page;
