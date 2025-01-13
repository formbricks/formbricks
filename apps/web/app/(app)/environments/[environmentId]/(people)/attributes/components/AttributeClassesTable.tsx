"use client";

import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TUserLocale } from "@formbricks/types/user";
import { AttributeDetailModal } from "./AttributeDetailModal";
import { AttributeClassDataRow } from "./AttributeRowData";

interface AttributeClassesTableProps {
  attributeClasses: TAttributeClass[];
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const AttributeClassesTable = ({
  attributeClasses,
  locale,
  isReadOnly,
}: AttributeClassesTableProps) => {
  const [isAttributeDetailModalOpen, setAttributeDetailModalOpen] = useState(false);
  const [activeAttributeClass, setActiveAttributeClass] = useState<TAttributeClass | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const t = useTranslations();
  const displayedAttributeClasses = useMemo(() => {
    return attributeClasses
      ? showArchived
        ? attributeClasses
        : attributeClasses.filter((ac) => !ac.archived)
      : [];
  }, [showArchived, attributeClasses]);

  const hasArchived = useMemo(() => {
    return attributeClasses ? attributeClasses.some((ac) => ac.archived) : false;
  }, [attributeClasses]);

  const handleOpenAttributeDetailModalClick = (attributeClass: TAttributeClass) => {
    setActiveAttributeClass(attributeClass);
    setAttributeDetailModalOpen(true);
  };

  const toggleShowArchived = () => {
    setShowArchived(!showArchived);
  };

  return (
    <>
      {hasArchived && (
        <div className="my-4 flex items-center justify-end text-right">
          <div className="flex items-center text-sm font-medium">
            <Label htmlFor="showArchivedToggle" className="cursor-pointer">
              {t("environments.attributes.show_archived")}
            </Label>
            <Switch
              id="showArchivedToggle"
              className="mx-3"
              checked={showArchived}
              onCheckedChange={toggleShowArchived}
            />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid h-12 grid-cols-5 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-3 pl-6">{t("common.name")}</div>
          <div className="hidden text-center sm:block">{t("common.created_at")}</div>
          <div className="hidden text-center sm:block">{t("common.updated_at")}</div>
        </div>
        <div className="grid-cols-7">
          {displayedAttributeClasses.map((attributeClass, index) => (
            <button
              onClick={() => handleOpenAttributeDetailModalClick(attributeClass)}
              className="w-full cursor-default"
              key={attributeClass.id}>
              <AttributeClassDataRow attributeClass={attributeClass} key={index} locale={locale} />
            </button>
          ))}
        </div>
        {activeAttributeClass && (
          <AttributeDetailModal
            open={isAttributeDetailModalOpen}
            setOpen={setAttributeDetailModalOpen}
            attributeClass={activeAttributeClass}
            isReadOnly={isReadOnly}
          />
        )}
      </div>
    </>
  );
};
