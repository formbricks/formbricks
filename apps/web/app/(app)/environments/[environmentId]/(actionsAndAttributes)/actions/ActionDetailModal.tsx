import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import EventActivityTab from "./ActionActivityTab";
import ActionSettingsTab from "./ActionSettingsTab";
import { TActionClass } from "@formbricks/types/v1/actionClasses";

interface ActionDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: TActionClass;
}

export default function ActionDetailModal({
  environmentId,
  open,
  setOpen,
  actionClass,
}: ActionDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <EventActivityTab actionClass={actionClass} />,
    },
    {
      title: "Settings",
      children: (
        <ActionSettingsTab environmentId={environmentId} actionClass={actionClass} setOpen={setOpen} />
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
