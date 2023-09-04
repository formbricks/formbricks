"use client";

import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { useUserSegments } from "@/lib/userSegments/userSegments";
import { TBaseFilterGroupItem } from "@formbricks/types/v1/userSegment";
import { Dialog, DialogContent, DialogTrigger, Input, TabBar } from "@formbricks/ui";
import { createId } from "@paralleldrive/cuid2";
import { MonitorSmartphoneIcon, MousePointerClick, PlusCircleIcon, TagIcon, Users2Icon } from "lucide-react";
import React, { useMemo, useState } from "react";

type TAddFilterModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilterGroupItem) => void;
  environmentId: string;
};

type TFilterType = "action" | "attribute" | "segment" | "device";

const AddFilterModal = ({ environmentId, onAddFilter, open, setOpen }: TAddFilterModalProps) => {
  const [activeTabId, setActiveTabId] = useState("actions");

  const { attributeClasses, isLoadingAttributeClasses } = useAttributeClasses(environmentId);
  const { eventClasses, isLoadingEventClasses } = useEventClasses(environmentId);
  const { userSegments, isLoadingUserSegments } = useUserSegments(environmentId);

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
    if (!eventClasses) return [];

    if (!searchValue) return eventClasses;

    return eventClasses.filter((eventClass) =>
      eventClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [eventClasses, searchValue]);

  const attributeClassesFiltered = useMemo(() => {
    if (!attributeClasses) return [];

    if (!searchValue) return attributeClasses;

    return attributeClasses.filter((attributeClass) =>
      attributeClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [attributeClasses, searchValue]);

  const userSegmentsFiltered = useMemo(() => {
    if (!userSegments) return [];

    if (!searchValue) return userSegments;

    return userSegments.filter((userSegment) =>
      userSegment.title.toLowerCase().includes(searchValue.toLowerCase())
    );
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
      <DialogTrigger className="max-w-[160px]">
        <button className="mt-4 flex items-center gap-2 text-sm">
          <PlusCircleIcon className="h-4 w-4" />
          <p>Add filter</p>
        </button>
      </DialogTrigger>

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
              {isLoadingEventClasses && <div>Loading...</div>}
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
              {isLoadingAttributeClasses && <div>Loading...</div>}
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
              {isLoadingUserSegments && <div>Loading...</div>}
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
