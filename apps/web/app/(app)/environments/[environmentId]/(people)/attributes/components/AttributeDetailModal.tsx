"use client";

import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { AttributeActivityTab } from "./AttributeActivityTab";
import { AttributeSettingsTab } from "./AttributeSettingsTab";

interface AttributeDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  attributeClass: TAttributeClass;
  isReadOnly: boolean;
}

export const AttributeDetailModal = ({
  open,
  setOpen,
  attributeClass,
  isReadOnly,
}: AttributeDetailModalProps) => {
  const t = useTranslations();
  const tabs = [
    {
      title: t("common.activity"),
      children: <AttributeActivityTab attributeClass={attributeClass} />,
    },
    {
      title: t("common.settings"),
      children: (
        <AttributeSettingsTab attributeClass={attributeClass} setOpen={setOpen} isReadOnly={isReadOnly} />
      ),
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
