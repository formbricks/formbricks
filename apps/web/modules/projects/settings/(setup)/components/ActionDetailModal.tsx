"use client";

import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ACTION_TYPE_ICON_LOOKUP } from "@/modules/projects/settings/(setup)/app-connection/utils";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { ActionActivityTab } from "./ActionActivityTab";
import { ActionSettingsTab } from "./ActionSettingsTab";

interface ActionDetailModalProps {
  environmentId: string;
  environment: TEnvironment;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  otherEnvironment: TEnvironment;
  otherEnvActionClasses: TActionClass[];
}

export const ActionDetailModal = ({
  environmentId,
  open,
  setOpen,
  actionClass,
  actionClasses,
  environment,
  isReadOnly,
  otherEnvActionClasses,
  otherEnvironment,
}: ActionDetailModalProps) => {
  const { t } = useTranslation();
  const tabs = [
    {
      title: t("common.activity"),
      children: (
        <ActionActivityTab
          otherEnvActionClasses={otherEnvActionClasses}
          otherEnvironment={otherEnvironment}
          isReadOnly={isReadOnly}
          environment={environment}
          actionClass={actionClass}
          environmentId={environmentId}
        />
      ),
    },
    {
      title: t("common.settings"),
      children: (
        <ActionSettingsTab
          actionClass={actionClass}
          actionClasses={actionClasses}
          setOpen={setOpen}
          isReadOnly={isReadOnly}
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
