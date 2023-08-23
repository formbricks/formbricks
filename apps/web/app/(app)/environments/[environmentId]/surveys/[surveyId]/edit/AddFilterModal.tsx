"use client";

import { TBaseFilterGroupItem, TUserSegmentFilter } from "@formbricks/types/v1/userSegment";
import React, { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, Input, TabBar } from "@formbricks/ui";
import { MonitorSmartphoneIcon, MousePointerClick, PlusCircleIcon, TagIcon, Users2Icon } from "lucide-react";
import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { createId } from "@paralleldrive/cuid2";

type TAddFilterModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilterGroupItem) => void;
  environmentId: string;
};

const AddFilterModal = ({ environmentId, onAddFilter, open, setOpen }: TAddFilterModalProps) => {
  const [activeTabId, setActiveTabId] = useState("all");

  const { attributeClasses } = useAttributeClasses(environmentId);
  const { eventClasses } = useEventClasses(environmentId);

  const tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { id: "all", label: "All" },
    { id: "actions", label: "Actions", icon: <MousePointerClick className="h-4 w-4" /> },
    { id: "attributes", label: "Attributes", icon: <TagIcon className="h-4 w-4" /> },
    { id: "segments", label: "Segments", icon: <Users2Icon className="h-4 w-4" /> },
    { id: "devices", label: "Devices", icon: <MonitorSmartphoneIcon className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
      <DialogTrigger className="max-w-[160px]">
        <button className="flex items-center gap-2 text-sm">
          <PlusCircleIcon className="h-4 w-4" />
          <p>Add filter</p>
        </button>
      </DialogTrigger>

      <DialogContent className="w-[600px] bg-slate-100 sm:max-w-2xl" hideCloseButton>
        <div className="flex w-auto flex-col">
          <Input placeholder="Browse filters..." autoFocus />

          <TabBar className="bg-slate-100" tabs={tabs} activeId={activeTabId} setActiveId={setActiveTabId} />
        </div>

        <div className="flex flex-col gap-2">
          {activeTabId === "actions" && (
            <>
              {eventClasses.map((eventClass) => {
                return (
                  <div className="flex cursor-pointer items-center gap-4 text-sm">
                    <MousePointerClick className="h-4 w-4" />
                    <p>{eventClass.name}</p>
                  </div>
                );
              })}
            </>
          )}

          {activeTabId === "attributes" && (
            <>
              {attributeClasses.map((attributeClass) => {
                return (
                  <div
                    onClick={() => {
                      const newFilter: TBaseFilterGroupItem = {
                        id: createId(),
                        connector: "and",
                        resource: {
                          id: createId(),
                          root: {
                            type: "attribute",
                            attributeClassId: attributeClass.id,
                          },
                          qualifier: {
                            operator: "equals",
                          },
                          value: "",
                        },
                      };

                      onAddFilter(newFilter);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-4 text-sm">
                    <TagIcon className="h-4 w-4" />
                    <p>{attributeClass.name}</p>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFilterModal;
