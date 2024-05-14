"use client";

import { createId } from "@paralleldrive/cuid2";
import { FingerprintIcon, MonitorSmartphoneIcon, MousePointerClick, TagIcon, Users2Icon } from "lucide-react";
import React, { useMemo, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import {
  TBaseFilter,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";
import { Input } from "@formbricks/ui/Input";
import { Modal } from "@formbricks/ui/Modal";
import { TabBar } from "@formbricks/ui/TabBar";

type TAddFilterModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilter) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
};

type TFilterType = "action" | "attribute" | "segment" | "device" | "person";

const handleAddFilter = ({
  type,
  onAddFilter,
  setOpen,
  attributeClassName,
  deviceType,
  actionClassId,
  segmentId,
}: {
  type: TFilterType;
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
  actionClassId?: string;
  attributeClassName?: string;
  segmentId?: string;
  deviceType?: string;
}) => {
  if (type === "action") {
    if (!actionClassId) return;

    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: {
        id: createId(),
        root: {
          type: type,
          actionClassId,
        },
        qualifier: {
          metric: "occuranceCount",
          operator: "greaterThan",
        },
        value: "",
      },
    };

    onAddFilter(newFilter);
    setOpen(false);
  }

  if (type === "attribute") {
    if (!attributeClassName) return;

    const newFilterResource: TSegmentAttributeFilter = {
      id: createId(),
      root: {
        type,
        attributeClassName,
      },
      qualifier: {
        operator: "equals",
      },
      value: "",
    };
    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: newFilterResource,
    };

    onAddFilter(newFilter);
    setOpen(false);
  }

  if (type === "person") {
    const newResource: TSegmentPersonFilter = {
      id: createId(),
      root: { type: "person", personIdentifier: "userId" },
      qualifier: {
        operator: "equals",
      },
      value: "",
    };

    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: newResource,
    };

    onAddFilter(newFilter);
    setOpen(false);
  }

  if (type === "segment") {
    if (!segmentId) return;

    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: {
        id: createId(),
        root: {
          type: type,
          segmentId,
        },
        qualifier: {
          operator: "userIsIn",
        },
        value: segmentId,
      },
    };

    onAddFilter(newFilter);
    setOpen(false);
  }

  if (type === "device") {
    if (!deviceType) return;

    const newFilter: TBaseFilter = {
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

type AttributeTabContentProps = {
  attributeClasses: TAttributeClass[];
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
};

const AttributeTabContent = ({ attributeClasses, onAddFilter, setOpen }: AttributeTabContentProps) => {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-medium">Person</h2>
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
            <p>userId</p>
          </div>
        </div>
      </div>

      <hr className="my-2" />

      <div>
        <h2 className="text-base font-medium">Attributes</h2>
      </div>
      {attributeClasses?.length === 0 && (
        <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
          <p>There are no attributes yet!</p>
        </div>
      )}
      {attributeClasses.map((attributeClass) => {
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
  );
};

export const AddFilterModal = ({
  onAddFilter,
  open,
  setOpen,
  actionClasses,
  attributeClasses,
  segments,
}: TAddFilterModalProps) => {
  const [activeTabId, setActiveTabId] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { id: "all", label: "All" },
    { id: "actions", label: "Actions", icon: <MousePointerClick className="h-4 w-4" /> },
    { id: "attributes", label: "Person & Attributes", icon: <TagIcon className="h-4 w-4" /> },
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

    return actionClasses.filter((actionClass) =>
      actionClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [actionClasses, searchValue]);

  const attributeClassesFiltered = useMemo(() => {
    if (!attributeClasses) return [];

    if (!searchValue) return attributeClasses;

    return attributeClasses.filter((attributeClass) =>
      attributeClass.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [attributeClasses, searchValue]);

  const personAttributesFiltered = useMemo(() => {
    const personAttributes = [{ name: "userId" }];

    return personAttributes.filter((personAttribute) =>
      personAttribute.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [searchValue]);

  const segmentsFiltered = useMemo(() => {
    if (!segments) return [];

    if (!searchValue) return segments.filter((segment) => !segment.isPrivate);

    return segments
      .filter((segment) => !segment.isPrivate)
      .filter((segment) => segment.title.toLowerCase().includes(searchValue.toLowerCase()));
  }, [segments, searchValue]);

  const deviceTypesFiltered = useMemo(() => {
    if (!searchValue) return devices;

    return devices.filter((deviceType) => deviceType.name.toLowerCase().includes(searchValue.toLowerCase()));
  }, [devices, searchValue]);

  const allFiltersFiltered = useMemo(
    () => [
      {
        attributes: attributeClassesFiltered,
        personAttributes: personAttributesFiltered,
        actions: actionClassesFiltered,
        segments: segmentsFiltered,
        devices: deviceTypesFiltered,
      },
    ],
    [
      actionClassesFiltered,
      attributeClassesFiltered,
      deviceTypesFiltered,
      personAttributesFiltered,
      segmentsFiltered,
    ]
  );

  const getAllTabContent = () => {
    return (
      <>
        {allFiltersFiltered?.every((filterArr) => {
          return (
            filterArr.actions.length === 0 &&
            filterArr.attributes.length === 0 &&
            filterArr.segments.length === 0 &&
            filterArr.devices.length === 0 &&
            filterArr.personAttributes.length === 0
          );
        }) && (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>There are no filters yet!</p>
          </div>
        )}

        {allFiltersFiltered.map((filters) => {
          return (
            <>
              {filters.actions.map((actionClass) => {
                return (
                  <div
                    onClick={() => {
                      handleAddFilter({
                        type: "action",
                        onAddFilter,
                        setOpen,
                        actionClassId: actionClass.id,
                      });
                    }}
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                    <MousePointerClick className="h-4 w-4" />
                    <p>{actionClass.name}</p>
                  </div>
                );
              })}

              {filters.attributes.map((attributeClass) => {
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

              {filters.personAttributes.map((personAttribute) => {
                return (
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
                    <p>{personAttribute.name}</p>
                  </div>
                );
              })}

              {filters.segments.map((segment) => {
                return (
                  <div
                    onClick={() => {
                      handleAddFilter({
                        type: "segment",
                        onAddFilter,
                        setOpen,
                        segmentId: segment.id,
                      });
                    }}
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                    <Users2Icon className="h-4 w-4" />
                    <p>{segment.title}</p>
                  </div>
                );
              })}

              {filters.devices.map((deviceType) => (
                <div
                  key={deviceType.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={() => {
                    handleAddFilter({
                      type: "device",
                      onAddFilter,
                      setOpen,
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
    );
  };

  const getActionsTabContent = () => {
    return (
      <>
        {actionClassesFiltered?.length === 0 && (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>There are no actions yet!</p>
          </div>
        )}
        {actionClassesFiltered.map((actionClass) => {
          return (
            <div
              onClick={() => {
                handleAddFilter({
                  type: "action",
                  onAddFilter,
                  setOpen,
                  actionClassId: actionClass.id,
                });
              }}
              className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
              <MousePointerClick className="h-4 w-4" />
              <p>{actionClass.name}</p>
            </div>
          );
        })}
      </>
    );
  };

  const getAttributesTabContent = () => {
    return (
      <AttributeTabContent
        attributeClasses={attributeClassesFiltered}
        onAddFilter={onAddFilter}
        setOpen={setOpen}
      />
    );
  };

  const getSegmentsTabContent = () => {
    return (
      <>
        {segmentsFiltered?.length === 0 && (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>You currently have no saved segments.</p>
          </div>
        )}
        {segmentsFiltered
          ?.filter((segment) => !segment.isPrivate)
          ?.map((segment) => {
            return (
              <div
                onClick={() => {
                  handleAddFilter({
                    type: "segment",
                    onAddFilter,
                    setOpen,
                    segmentId: segment.id,
                  });
                }}
                className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                <Users2Icon className="h-4 w-4" />
                <p>{segment.title}</p>
              </div>
            );
          })}
      </>
    );
  };

  const getDevicesTabContent = () => {
    return (
      <div className="flex flex-col">
        {deviceTypesFiltered.map((deviceType) => (
          <div
            key={deviceType.id}
            className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
            onClick={() => {
              handleAddFilter({
                type: "device",
                onAddFilter,
                setOpen,
                deviceType: deviceType.id,
              });
            }}>
            <MonitorSmartphoneIcon className="h-4 w-4" />
            <span>{deviceType.name}</span>
          </div>
        ))}
      </div>
    );
  };

  const TabContent = (): JSX.Element => {
    switch (activeTabId) {
      case "all": {
        return getAllTabContent();
      }
      case "actions": {
        return getActionsTabContent();
      }
      case "attributes": {
        return getAttributesTabContent();
      }
      case "segments": {
        return getSegmentsTabContent();
      }
      case "devices": {
        return getDevicesTabContent();
      }
      default: {
        return getAllTabContent();
      }
    }
  };

  return (
    <Modal
      hideCloseButton
      open={open}
      setOpen={setOpen}
      closeOnOutsideClick
      className="sm:w-[650px] sm:max-w-full">
      <div className="flex w-auto flex-col">
        <Input placeholder="Browse filters..." autoFocus onChange={(e) => setSearchValue(e.target.value)} />
        <TabBar className="bg-white" tabs={tabs} activeId={activeTabId} setActiveId={setActiveTabId} />
      </div>

      <div className={cn("mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto")}>
        <TabContent />
      </div>
    </Modal>
  );
};
