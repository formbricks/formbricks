import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import type { EventClass } from "@prisma/client";
import EventActivityTab from "./ActionActivityTab";
import ActionSettingsTab from "./ActionSettingsTab";

interface ActionDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClass: EventClass;
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
      children: <EventActivityTab environmentId={environmentId} actionClassId={actionClass.id} />,
    },
    {
      title: "Settings",
      children: (
        <ActionSettingsTab environmentId={environmentId} eventClassId={actionClass.id} setOpen={setOpen} />
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
