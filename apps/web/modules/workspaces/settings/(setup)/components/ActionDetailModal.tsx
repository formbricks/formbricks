"use client";

import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { ACTION_TYPE_ICON_LOOKUP } from "@/modules/workspaces/settings/(setup)/app-connection/utils";
import { ActionActivityTab } from "./ActionActivityTab";
import { ActionSettingsTab } from "./ActionSettingsTab";

interface ActionDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  hideDelete?: boolean;
  hideActivityTab?: boolean;
  currentSurveyId?: string;
  onActionUpdated?: (updatedAction: TActionClass) => void;
}

export const ActionDetailModal = ({
  open,
  setOpen,
  actionClass,
  actionClasses,
  isReadOnly,
  hideDelete,
  hideActivityTab,
  currentSurveyId,
  onActionUpdated,
}: ActionDetailModalProps) => {
  const { t } = useTranslation();
  const tabs = [
    ...(hideActivityTab
      ? []
      : [
          {
            title: t("common.activity"),
            children: <ActionActivityTab actionClass={actionClass} />,
          },
        ]),
    {
      title: t("common.settings"),
      children: (
        <ActionSettingsTab
          actionClass={actionClass}
          actionClasses={actionClasses}
          setOpen={setOpen}
          isReadOnly={isReadOnly}
          hideDelete={hideDelete}
          currentSurveyId={currentSurveyId}
          onActionUpdated={onActionUpdated}
        />
      ),
    },
  ];

  const typeDescription = () => {
    if (actionClass.description) return actionClass.description;
    else
      return (
        (actionClass.type && actionClass.type === "noCode" ? t("common.no_code") : t("common.code")) +
        " " +
        t("common.action").toLowerCase()
      );
  };

  return (
    <ModalWithTabs
      open={open}
      setOpen={setOpen}
      tabs={tabs}
      icon={ACTION_TYPE_ICON_LOOKUP[actionClass.type]}
      label={actionClass.name}
      description={typeDescription()}
    />
  );
};
