import ModalWithTabs from "@formbricks/ui/ModalWithTabs";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import EventActivityTab from "./ActionActivityTab";
import ActionSettingsTab from "./ActionSettingsTab";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TMembershipRole } from "@formbricks/types/memberships";

interface ActionDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: TActionClass;
  membershipRole?: TMembershipRole;
}

export default function ActionDetailModal({
  environmentId,
  open,
  setOpen,
  actionClass,
  membershipRole,
}: ActionDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <EventActivityTab actionClass={actionClass} environmentId={environmentId} />,
    },
    {
      title: "Settings",
      children: (
        <ActionSettingsTab
          environmentId={environmentId}
          actionClass={actionClass}
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
            <CodeBracketIcon />
          ) : actionClass.type === "noCode" ? (
            <CursorArrowRaysIcon />
          ) : actionClass.type === "automatic" ? (
            <SparklesIcon />
          ) : null
        }
        label={actionClass.name}
        description={actionClass.description || ""}
      />
    </>
  );
}
