import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { TagIcon } from "@heroicons/react/24/solid";
import type { AttributeClass } from "@prisma/client";
import AttributeActivityTab from "./AttributeActivityTab";
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
      children: <AttributeActivityTab environmentId={environmentId} attributeClassId={attributeClass.id} />,
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
