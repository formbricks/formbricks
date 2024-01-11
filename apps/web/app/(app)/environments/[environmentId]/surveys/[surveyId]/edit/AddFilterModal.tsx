"use client";

import { createId } from "@paralleldrive/cuid2";
import { MonitorSmartphoneIcon, MousePointerClick, TagIcon, Users2Icon } from "lucide-react";
import React, { useMemo, useState } from "react";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilterGroupItem, TUserSegment } from "@formbricks/types/userSegment";
import { Dialog, DialogContent } from "@formbricks/ui/Dialog";
import { Input } from "@formbricks/ui/Input";
import { TabBar } from "@formbricks/ui/TabBar";

type TAddFilterModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilterGroupItem) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  userSegments: TUserSegment[];
};

type TFilterType = "action" | "attribute" | "segment" | "device";

const AddFilterModal = ({
  onAddFilter,
  open,
  setOpen,
  actionClasses,
  attributeClasses,
  userSegments,
}: TAddFilterModalProps) => {
  const [activeTabId, setActiveTabId] = useState("actions");

  const [searchValue, setSearchValue] = useState("");

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const devices = [
    { id: "phone", name: "Phone" },
    { id: "desktop", name: "Desktop" },
  ];

  const actionClassesFiltered = useMemo(() => {
    if (!actionClasses) return [];

    if (!searchValue) return actionClasses;

    return actionClasses.filter((eventClass) =>
      eventClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [actionClasses, searchValue]);

  const attributeClassesFiltered = useMemo(() => {
    if (!attributeClasses) return [];

    if (!searchValue) return attributeClasses;

    return attributeClasses.filter((attributeClass) =>
      attributeClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [attributeClasses, searchValue]);

  const userSegmentsFiltered = useMemo(() => {
    if (!userSegments) return [];

    if (!searchValue) return userSegments.filter((userSegment) => !userSegment.isPrivate);

    return userSegments
      .filter((userSegment) => !userSegment.isPrivate)
      .filter((userSegment) => userSegment.title.toLowerCase().includes(searchValue.toLowerCase()));
  }, [userSegments, searchValue]);

  const deviceTypesFiltered = useMemo(() => {
    if (!searchValue) return devices;

    return devices.filter((deviceType) => deviceType.name.toLowerCase().includes(searchValue.toLowerCase()));
  }, [devices, searchValue]);

  const allFiltersFiltered = useMemo(
    () => [
      {
        attributes: attributeClassesFiltered,
        actions: actionClassesFiltered,
        segments: userSegmentsFiltered,
        devices: deviceTypesFiltered,
      },
    ],
    [actionClassesFiltered, attributeClassesFiltered, deviceTypesFiltered, userSegmentsFiltered]
  );

  const handleAddFilter = ({
    type,
    attributeClassId,
    deviceType,
    eventClassId,
    userSegmentId,
  }: {
    type: TFilterType;
    eventClassId?: string;
    attributeClassId?: string;
    userSegmentId?: string;
    deviceType?: string;
  }) => {
    if (type === "action") {
      if (!eventClassId) return;

      const newFilter: TBaseFilterGroupItem = {
        id: createId(),
        connector: "and",
        resource: {
          id: createId(),
          root: {
            type: type,
            actionClassId: eventClassId,
          },
          qualifier: {
            metric: "occuranceCount",
            operator: "equals",
          },
          value: "",
        },
      };

      onAddFilter(newFilter);
      setOpen(false);
    }

    if (type === "attribute") {
      if (!attributeClassId) return;

      const newFilter: TBaseFilterGroupItem = {
        id: createId(),
        connector: "and",
        resource: {
          id: createId(),
          root: {
            type: type,
            attributeClassId,
          },
          qualifier: {
            operator: "equals",
          },
          value: "",
        },
      };

      onAddFilter(newFilter);
      setOpen(false);
    }

    if (type === "segment") {
      if (!userSegmentId) return;

      const newFilter: TBaseFilterGroupItem = {
        id: createId(),
        connector: "and",
        resource: {
          id: createId(),
          root: {
            type: type,
            userSegmentId,
          },
          qualifier: {
            operator: "userIsIn",
          },
          value: userSegmentId,
        },
      };

      onAddFilter(newFilter);
      setOpen(false);
    }

    if (type === "device") {
      if (!deviceType) return;

      const newFilter: TBaseFilterGroupItem = {
        id: createId(),
        connector: "and",
        resource: {
          id: createId(),
          root: {
            type: type,
            deviceType,
          },
          qualifier: {
            operator: "equals",
          },
          value: deviceType,
        },
      };

      onAddFilter(newFilter);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
      <DialogContent className="w-[600px] bg-white sm:max-w-2xl" hideCloseButton>
        <div className="flex w-auto flex-col">
          <Input placeholder="Browse filters..." autoFocus onChange={(e) => setSearchValue(e.target.value)} />

          <TabBar className="bg-white" tabs={tabs} activeId={activeTabId} setActiveId={setActiveTabId} />
        </div>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {activeTabId === "all" && (
            <>
              {allFiltersFiltered.map((filterGroup) => {
                return (
                  <>
                    {filterGroup.actions.map((eventClass) => {
                      return (
                        <div
                          onClick={() => {
                            handleAddFilter({
                              type: "action",
                              eventClassId: eventClass.id,
                            });
                          }}
                          className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                          <MousePointerClick className="h-4 w-4" />
                          <p>{eventClass.name}</p>
                        </div>
                      );
                    })}

                    {filterGroup.attributes.map((attributeClass) => {
                      return (
                        <div
                          onClick={() => {
                            handleAddFilter({
                              type: "attribute",
                              attributeClassId: attributeClass.id,
                            });
                          }}
                          className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                          <TagIcon className="h-4 w-4" />
                          <p>{attributeClass.name}</p>
                        </div>
                      );
                    })}

                    {filterGroup.segments.map((userSegment) => {
                      return (
                        <div
                          onClick={() => {
                            handleAddFilter({
                              type: "segment",
                              userSegmentId: userSegment.id,
                            });
                          }}
                          className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                          <Users2Icon className="h-4 w-4" />
                          <p>{userSegment.title}</p>
                        </div>
                      );
                    })}

                    {filterGroup.devices.map((deviceType) => (
                      <div
                        key={deviceType.id}
                        className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                        onClick={() => {
                          handleAddFilter({
                            type: "device",
                            deviceType: deviceType.id,
                          });
                        }}>
                        <MonitorSmartphoneIcon className="h-4 w-4" />
                        <span>{deviceType.name}</span>
                      </div>
                    ))}
                  </>
                );
              })}
            </>
          )}

          {activeTabId === "actions" && (
            <>
              {actionClassesFiltered.map((eventClass) => {
                return (
                  <div
                    onClick={() => {
                      handleAddFilter({
                        type: "action",
                        eventClassId: eventClass.id,
                      });
                    }}
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                    <MousePointerClick className="h-4 w-4" />
                    <p>{eventClass.name}</p>
                  </div>
                );
              })}
            </>
          )}

          {activeTabId === "attributes" && (
            <>
              {attributeClassesFiltered.map((attributeClass) => {
                return (
                  <div
                    onClick={() => {
                      handleAddFilter({
                        type: "attribute",
                        attributeClassId: attributeClass.id,
                      });
                    }}
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                    <TagIcon className="h-4 w-4" />
                    <p>{attributeClass.name}</p>
                  </div>
                );
              })}
            </>
          )}

          {activeTabId === "segments" && (
            <>
              {userSegmentsFiltered
                ?.filter((segment) => !segment.isPrivate)
                ?.map((userSegment) => {
                  return (
                    <div
                      onClick={() => {
                        handleAddFilter({
                          type: "segment",
                          userSegmentId: userSegment.id,
                        });
                      }}
                      className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                      <Users2Icon className="h-4 w-4" />
                      <p>{userSegment.title}</p>
                    </div>
                  );
                })}
            </>
          )}

          {activeTabId === "devices" && (
            <div className="flex flex-col">
              {deviceTypesFiltered.map((deviceType) => (
                <div
                  key={deviceType.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={() => {
                    handleAddFilter({
                      type: "device",
                      deviceType: deviceType.id,
                    });
                  }}>
                  <MonitorSmartphoneIcon className="h-4 w-4" />
                  <span>{deviceType.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFilterModal;
