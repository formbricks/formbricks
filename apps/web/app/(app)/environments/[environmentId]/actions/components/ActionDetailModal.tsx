import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { TActionClass } from "@formbricks/types/action-classes";
import { TMembershipRole } from "@formbricks/types/memberships";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";
import { ActionActivityTab } from "./ActionActivityTab";
import { ActionSettingsTab } from "./ActionSettingsTab";

interface ActionDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  membershipRole?: TMembershipRole;
}

export const ActionDetailModal = ({
  environmentId,
  open,
  setOpen,
  actionClass,
  actionClasses,
  membershipRole,
}: ActionDetailModalProps) => {
  const tabs = [
    {
      title: "Activity",
      children: <ActionActivityTab actionClass={actionClass} environmentId={environmentId} />,
    },
    {
      title: "Settings",
      children: (
        <ActionSettingsTab
          actionClass={actionClass}
          actionClasses={actionClasses}
          setOpen={setOpen}
          membershipRole={membershipRole}
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
