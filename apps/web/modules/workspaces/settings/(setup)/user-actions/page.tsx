"use server";

import { getActionClasses } from "@/lib/actionClass/service";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ActionSettingsCard } from "../components/action-settings-card";

export const UserActionsPage = async ({ params }: { params: Promise<{ workspaceId: string }> }) => {
  const t = await getTranslate();
  const { workspaceId } = await params;

  const { isReadOnly, session, workspace } = await getWorkspaceAuth(workspaceId);

  const [actionClasses, locale] = await Promise.all([
    getActionClasses(workspace.id),
    getUserLocale(session.user.id),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.user_actions")} />
      <div className="space-y-4">
        <ActionSettingsCard
          workspaceId={workspace.id}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};
