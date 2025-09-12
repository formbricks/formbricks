"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { ActionClassesTable } from "@/modules/projects/settings/(setup)/components/ActionClassesTable";
import { ActionClassDataRow } from "@/modules/projects/settings/(setup)/components/ActionRowData";
import { ActionTableHeading } from "@/modules/projects/settings/(setup)/components/ActionTableHeading";
import { AddActionModal } from "@/modules/projects/settings/(setup)/components/AddActionModal";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TUserLocale } from "@formbricks/types/user";

interface ActionSettingsCardProps {
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  otherEnvActionClasses: TActionClass[];
  environmentId: string;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  locale: TUserLocale;
}
export const ActionSettingsCard = ({
  environment,
  otherEnvironment,
  otherEnvActionClasses,
  environmentId,
  actionClasses,
  isReadOnly,
  locale,
}: ActionSettingsCardProps) => {
  const { t } = useTranslate();
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
          environment={environment}
          otherEnvironment={otherEnvironment}
          otherEnvActionClasses={otherEnvActionClasses}
          environmentId={environmentId}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}>
          <ActionTableHeading />
          {actionClasses.map((actionClass) => (
            <ActionClassDataRow key={actionClass.id} actionClass={actionClass} locale={locale} />
          ))}
        </ActionClassesTable>
      </SettingsCard>
      <AddActionModal
        environmentId={environmentId}
        actionClasses={actionClasses}
        isReadOnly={isReadOnly}
        open={isActionModalOpen}
        setOpen={setIsActionModalOpen}
      />
    </>
  );
};
