"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { TUserLocale } from "@formbricks/types/user";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { ActionClassesTable } from "@/modules/workspaces/settings/(setup)/components/ActionClassesTable";
import { AddActionModal } from "@/modules/workspaces/settings/(setup)/components/AddActionModal";

interface ActionSettingsCardProps {
  workspaceId: string;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  locale: TUserLocale;
}
export const ActionSettingsCard = ({
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
        }}
        // The "Add action" control lives in the card's header, so the table is the only body content and
        // can run edge to edge with nothing above it needing a gutter.
        bodyVariant="flush">
        <ActionClassesTable actionClasses={actionClasses} isReadOnly={isReadOnly} locale={locale} />
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
