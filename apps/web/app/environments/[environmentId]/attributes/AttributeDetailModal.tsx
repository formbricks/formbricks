import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { TagIcon } from "@heroicons/react/24/solid";
import AttributeActivityTab from "./AttributeActivityTab";
import type { AttributeClass } from "@prisma/client";
import AttributeSettingsTab from "./AttributeSettingsTab";

interface AttributeDetailModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  attributeClass: AttributeClass;
}

export default function AttributeDetailModal({
  environmentId,
  open,
  setOpen,
  attributeClass,
}: AttributeDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <AttributeActivityTab attributeClass={attributeClass} />,
    },
    {
      title: "Settings",
      children: (
        <AttributeSettingsTab
          attributeClass={attributeClass}
          environmentId={environmentId}
          setOpen={setOpen}
        />
      ),
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
      />
    </>
  );
}
