"use client";

import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { useTranslate } from "@tolgee/react";
import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
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
  const { t } = useTranslate();
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

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={
          actionClass.type === "code" ? (
            <Code2Icon className="h-5 w-5" />
          ) : actionClass.type === "noCode" ? (
            <MousePointerClickIcon className="h-5 w-5" />
          ) : actionClass.type === "automatic" ? (
            <SparklesIcon className="h-5 w-5" />
          ) : null
        }
        label={actionClass.name}
        description={actionClass.description || ""}
      />
    </>
  );
};
