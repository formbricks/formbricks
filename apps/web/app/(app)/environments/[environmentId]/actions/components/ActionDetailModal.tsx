import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";
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
  toCopyEnvironment: TEnvironment;
  toCopyActionClasses: TActionClass[];
}

export const ActionDetailModal = ({
  environmentId,
  open,
  setOpen,
  actionClass,
  actionClasses,
  environment,
  isReadOnly,
  toCopyActionClasses,
  toCopyEnvironment,
}: ActionDetailModalProps) => {
  const t = useTranslations();
  const tabs = [
    {
      title: t("common.activity"),
      children: (
        <ActionActivityTab
          toCopyActionClasses={toCopyActionClasses}
          toCopyEnvironment={toCopyEnvironment}
          isViewer={isReadOnly}
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
