"use client";

import { createId } from "@paralleldrive/cuid2";
import { TagIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TUserSegmentAttributeFilter } from "@formbricks/types/userSegment";
import { Input } from "@formbricks/ui/Input";
import { Modal } from "@formbricks/ui/Modal";

type TBasicAddFilterModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilter) => void;
  attributeClasses: TAttributeClass[];
};

const BasicAddFilterModal = ({ onAddFilter, open, setOpen, attributeClasses }: TBasicAddFilterModalProps) => {
  const [searchValue, setSearchValue] = useState("");

  const attributeClassesFiltered = useMemo(() => {
    if (!attributeClasses) return [];

    if (!searchValue) return attributeClasses;

    return attributeClasses.filter((attributeClass) =>
      attributeClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [attributeClasses, searchValue]);

  const handleAddFilter = ({
    attributeClassName,
    isUserId = false,
  }: {
    attributeClassName?: string;
    isUserId?: boolean;
  }) => {
    if (!attributeClassName) return;

    const newFilterResource: TUserSegmentAttributeFilter = {
      id: createId(),
      root: {
        type: "attribute",
        attributeClassName,
      },
      qualifier: {
        operator: "equals",
      },
      value: "",
      ...(isUserId && { meta: { isUserId } }),
    };

    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: newFilterResource,
    };

    onAddFilter(newFilter);
    setOpen(false);
  };

  return (
    <Modal hideCloseButton open={open} setOpen={setOpen} closeOnOutsideClick>
      <div className="flex w-auto flex-col">
        <Input placeholder="Browse filters..." autoFocus onChange={(e) => setSearchValue(e.target.value)} />
      </div>

      <div className={cn("mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto")}>
        <>
          {attributeClassesFiltered?.length === 0 && (
            <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
              <p>There are no attributes available</p>
            </div>
          )}
          {attributeClassesFiltered.map((attributeClass) => {
            return (
              <div
                onClick={() => {
                  handleAddFilter({
                    attributeClassName: attributeClass.name,
                    isUserId: attributeClass.name === "userId" && attributeClass.type === "automatic",
                  });
                }}
                className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                <TagIcon className="h-4 w-4" />
                <p>{attributeClass.name}</p>
              </div>
            );
          })}
        </>
      </div>
    </Modal>
  );
};

export default BasicAddFilterModal;
