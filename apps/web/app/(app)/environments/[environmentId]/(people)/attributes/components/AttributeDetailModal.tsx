import { TagIcon } from "lucide-react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";
import { AttributeActivityTab } from "./AttributeActivityTab";
import { AttributeSettingsTab } from "./AttributeSettingsTab";

interface AttributeDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  attributeClass: TAttributeClass;
}

export const AttributeDetailModal = ({ open, setOpen, attributeClass }: AttributeDetailModalProps) => {
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
        icon={<TagIcon className="h-5 w-5" />}
        label={attributeClass.name}
        description={attributeClass.description || ""}
      />
    </>
  );
};
