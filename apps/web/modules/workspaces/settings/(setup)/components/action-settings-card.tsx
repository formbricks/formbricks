"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { TUserLocale } from "@formbricks/types/user";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { ActionClassesTable } from "@/modules/workspaces/settings/(setup)/components/ActionClassesTable";
import { ActionClassDataRow } from "@/modules/workspaces/settings/(setup)/components/ActionRowData";
import { ActionTableHeading } from "@/modules/workspaces/settings/(setup)/components/ActionTableHeading";
import { AddActionModal } from "@/modules/workspaces/settings/(setup)/components/AddActionModal";

interface ActionSettingsCardProps {
  otherEnvActionClasses: TActionClass[];
  workspaceId: string;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  locale: TUserLocale;
}
export const ActionSettingsCard = ({
  otherEnvActionClasses,
  workspaceId,
  actionClasses,
  isReadOnly,
  locale,
}: ActionSettingsCardProps) => {
  const { t } = useTranslation();
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  return (
    <>
      <SettingsCard
        title={t("common.actions")}
        description={t("common.actions_description")}
        buttonInfo={{
          text: t("common.add_action"),
          onClick: () => setIsActionModalOpen(true),
          variant: "default",
        }}>
        <ActionClassesTable
          otherEnvActionClasses={otherEnvActionClasses}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}>
          <ActionTableHeading />
          {actionClasses.map((actionClass) => (
            <ActionClassDataRow key={actionClass.id} actionClass={actionClass} locale={locale} />
          ))}
        </ActionClassesTable>
      </SettingsCard>
      <AddActionModal
        workspaceId={workspaceId}
        actionClasses={actionClasses}
        isReadOnly={isReadOnly}
        open={isActionModalOpen}
        setOpen={setIsActionModalOpen}
      />
    </>
  );
};
