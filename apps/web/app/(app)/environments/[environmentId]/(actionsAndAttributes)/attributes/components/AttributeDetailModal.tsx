import { TagIcon } from "@heroicons/react/24/solid";

import { TAttributeClass } from "@formbricks/types/attributeClasses";
import ModalWithTabs from "@formbricks/ui/ModalWithTabs";

import AttributeActivityTab from "./AttributeActivityTab";
import AttributeSettingsTab from "./AttributeSettingsTab";

interface AttributeDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  attributeClass: TAttributeClass;
}

export default function AttributeDetailModal({ open, setOpen, attributeClass }: AttributeDetailModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <AttributeActivityTab attributeClass={attributeClass} />,
    },
    {
      title: "Settings",
      children: <AttributeSettingsTab attributeClass={attributeClass} setOpen={setOpen} />,
    },
  ];

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
