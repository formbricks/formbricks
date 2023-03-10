import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import ActivityTab from "./ActivityTab";
import SettingsTab from "./SettingsTab";
import type { EventClass } from "@prisma/client";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  eventClass: EventClass;
}

export default function EventDetailModal({ open, setOpen, eventClass }: EventDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <ActivityTab eventClass={eventClass} />,
    },
    {
      title: "Settings",
      children: <SettingsTab eventClass={eventClass} />,
    },
  ];

  const saveChanges = () => {
    console.log("Save changes");
    setOpen(false);
  };

  const handleArchive = () => {
    console.log("Archive");
    setOpen(false);
  };

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={
          eventClass.type === "code" ? (
            <CodeBracketIcon />
          ) : eventClass.type === "noCode" ? (
            <CursorArrowRaysIcon />
          ) : eventClass.type === "automatic" ? (
            <SparklesIcon />
          ) : null
        }
        label={eventClass.name}
        description={eventClass.description || ""}
        onSave={saveChanges}
        onArchive={handleArchive}
        hrefDocs="https://formbricks.com/docs"
      />
    </>
  );
}
