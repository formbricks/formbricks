import { useState } from "react";
import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  eventId?: string;
}

export default function EventDetailModal({ open, setOpen, eventId }: EventDetailModalProps) {
  /*   const [isModalOpen, setIsModalOpen] = useState(false);   */

  const tabs = [
    {
      title: "Activity",
      children: <p>This is the content of Tab 1</p>,
    },
    {
      title: "Settings",
      children: <p>This is the content of Tab 2</p>,
    },
  ];

  const eventObject = {
    id: "1",
    label: "Event 1",
    icon: <CursorArrowRaysIcon />,
  };

  const saveChanges = () => {
    console.log("Save changes"); /* 
    setIsModalOpen(false); */
  };

  const handleArchive = () => {
    console.log("Archive"); /* 
    setIsModalOpen(false); */
  };

  return (
    <>
      {/* 
      <button onClick={() => setIsModalOpen(true)}>Open Modal</button> */}
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={eventObject.icon}
        label={eventObject.label}
        onSave={saveChanges}
        onArchive={handleArchive}
        hrefDocs="https://formbricks.com/docs"
      />
    </>
  );
}
