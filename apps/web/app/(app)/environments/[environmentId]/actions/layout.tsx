import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export default async function ActionsLayout({ children, params }) {
  const environmentId = params.environmentId;

  const [actionClasses] = await Promise.all([getActionClasses(params.environmentId)]);

  const renderAddActionButton = () => (
    <AddActionModal environmentId={environmentId} actionClasses={actionClasses} />
  );

  return (
    <InnerContentWrapper pageTitle="Actions" cta={renderAddActionButton()}>
      {children}
    </InnerContentWrapper>
  );
}
