import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironments } from "@formbricks/lib/environment/service";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async (props) => {
  const params = await props.params;

  const { isReadOnly, project, isBilling, environment } = await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();

  const [actionClasses] = await Promise.all([getActionClasses(params.environmentId)]);

  const environments = await getEnvironments(project.id);

  const otherEnvironment = environments.filter((env) => env.id !== params.environmentId)[0];

  const otherEnvActionClasses = await getActionClasses(otherEnvironment.id);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const renderAddActionButton = () => (
    <AddActionModal
      environmentId={params.environmentId}
      actionClasses={actionClasses}
      isReadOnly={isReadOnly}
    />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.actions")} cta={!isReadOnly ? renderAddActionButton() : undefined} />
      <ActionClassesTable
        environment={environment}
        otherEnvironment={otherEnvironment}
        otherEnvActionClasses={otherEnvActionClasses}
        environmentId={params.environmentId}
        actionClasses={actionClasses}
        isReadOnly={isReadOnly}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </PageContentWrapper>
  );
};

export default Page;
