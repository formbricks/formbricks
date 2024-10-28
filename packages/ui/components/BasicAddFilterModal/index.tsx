"use client";

import { FingerprintIcon, TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TBaseFilter } from "@formbricks/types/segment";
import { Input } from "../Input";
import { Modal } from "../Modal";
import { handleAddFilter } from "./lib/utils";

interface TBasicAddFilterModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilter) => void;
  attributeClasses: TAttributeClass[];
}

export const BasicAddFilterModal = ({
  onAddFilter,
  open,
  setOpen,
  attributeClasses,
}: TBasicAddFilterModalProps) => {
  const [searchValue, setSearchValue] = useState("");
  const t = useTranslations();
  const attributeClassesFiltered = useMemo(() => {
    if (!attributeClasses) return [];

    if (!searchValue) return attributeClasses;

    return attributeClasses.filter((attributeClass) =>
      attributeClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [attributeClasses, searchValue]);

  return (
    <Modal hideCloseButton open={open} setOpen={setOpen} closeOnOutsideClick>
      <div className="flex w-auto flex-col">
        <Input placeholder="Browse filters..." autoFocus onChange={(e) => setSearchValue(e.target.value)} />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <div>
          <h2 className="text-base font-medium">{t("common.person")}</h2>
          <div>
            <div
              onClick={() => {
                handleAddFilter({
                  type: "person",
                  onAddFilter,
                  setOpen,
                });
              }}
              className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
              <FingerprintIcon className="h-4 w-4" />
              <p>{t("common.user_id")}</p>
            </div>
          </div>
        </div>

        <hr />

        <div>
          <h2 className="text-base font-medium">{t("common.attributes")}</h2>
        </div>
        {attributeClassesFiltered?.length === 0 && (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>{t("ee.advanced_targeting.no_attributes_yet")}</p>
          </div>
        )}
        {attributeClassesFiltered.map((attributeClass) => {
          return (
            <div
              onClick={() => {
                handleAddFilter({
                  type: "attribute",
                  onAddFilter,
                  setOpen,
                  attributeClassName: attributeClass.name,
                });
              }}
              className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
              <TagIcon className="h-4 w-4" />
              <p>{attributeClass.name}</p>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
