import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import EventActivityTab from "./EventActivityTab";
import EventSettingsTab from "./EventSettingsTab";
import type { EventClass } from "@prisma/client";
import { useEventClassMutation } from "@/lib/eventClasses/mutateEventClasses";

interface EventDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  eventClass: EventClass;
}

export default function EventDetailModal({
  environmentId,
  open,
  setOpen,
  eventClass,
}: EventDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <EventActivityTab eventClass={eventClass} />,
    },
    {
      title: "Settings",
      children: <EventSettingsTab eventClass={eventClass} environmentId={environmentId} setOpen={setOpen} />,
    },
  ];

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
      />
    </>
  );
}
