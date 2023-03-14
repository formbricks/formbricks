import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { TagIcon } from "@heroicons/react/24/solid";
import AttributeActivityTab from "./AttributeActivityTab";
import type { AttributeClass } from "@prisma/client";
import AttributeSettingsTab from "./AttirbuteSettingsTab";

interface AttributeDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  attributeClass: AttributeClass;
}

export default function AttributeDetailModal({ open, setOpen, attributeClass }: AttributeDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <AttributeActivityTab attributeClass={attributeClass} />,
    },
    {
      title: "Settings",
      children: <AttributeSettingsTab attributeClass={attributeClass} />,
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
        icon={<TagIcon />}
        label={attributeClass.name}
        description={attributeClass.description || ""}
        onSave={saveChanges}
        onArchive={handleArchive}
        hrefDocs="https://formbricks.com/docs"
        isAttribute
      />
    </>
  );
}
