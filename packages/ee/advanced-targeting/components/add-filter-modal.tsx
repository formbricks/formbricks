"use client";

import { createId } from "@paralleldrive/cuid2";
import { FingerprintIcon, MonitorSmartphoneIcon, TagIcon, Users2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type {
  TBaseFilter,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";
import { Input } from "@formbricks/ui/components/Input";
import { Modal } from "@formbricks/ui/components/Modal";
import { TabBar } from "@formbricks/ui/components/TabBar";

interface TAddFilterModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilter) => void;
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
}

type TFilterType = "attribute" | "segment" | "device" | "person";

const handleAddFilter = ({
  type,
  onAddFilter,
  setOpen,
  attributeClassName,
  deviceType,
  segmentId,
}: {
  type: TFilterType;
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
  attributeClassName?: string;
  segmentId?: string;
  deviceType?: string;
}): void => {
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
          type,
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
          type,
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

interface AttributeTabContentProps {
  attributeClasses: TAttributeClass[];
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
}

function AttributeTabContent({ attributeClasses, onAddFilter, setOpen }: AttributeTabContentProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-medium">{t("common.person")}</h2>
        <div>
          <div
            className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
            onClick={() => {
              handleAddFilter({
                type: "person",
                onAddFilter,
                setOpen,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAddFilter({
                  type: "person",
                  onAddFilter,
                  setOpen,
                });
              }
            }}>
            <FingerprintIcon className="h-4 w-4" />
            <p>{t("common.user_id")}</p>
          </div>
        </div>
      </div>

      <hr className="my-2" />

      <div>
        <h2 className="text-base font-medium">{t("common.attributes")}</h2>
      </div>
      {attributeClasses.length === 0 && (
        <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
          <p>{t("ee.advanced_targeting.no_attributes_yet")}</p>
        </div>
      )}
      {attributeClasses.map((attributeClass) => {
        return (
          <div
            className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
            key={attributeClass.id}
            onClick={() => {
              handleAddFilter({
                type: "attribute",
                onAddFilter,
                setOpen,
                attributeClassName: attributeClass.name,
              });
            }}>
            <TagIcon className="h-4 w-4" />
            <p>{attributeClass.name}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AddFilterModal({
  onAddFilter,
  open,
  setOpen,
  attributeClasses,
  segments,
}: TAddFilterModalProps) {
  const [activeTabId, setActiveTabId] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const t = useTranslations();
  const tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { id: "all", label: t("common.all") },
    {
      id: "attributes",
      label: t("ee.advanced_targeting.person_and_attributes"),
      icon: <TagIcon className="h-4 w-4" />,
    },
    { id: "segments", label: t("common.segments"), icon: <Users2Icon className="h-4 w-4" /> },
    {
      id: "devices",
      label: t("ee.advanced_targeting.devices"),
      icon: <MonitorSmartphoneIcon className="h-4 w-4" />,
    },
  ];

  const devices = useMemo(
    () => [
      { id: "phone", name: t("ee.advanced_targeting.phone") },
      { id: "desktop", name: t("ee.advanced_targeting.desktop") },
    ],
    []
  );

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
        segments: segmentsFiltered,
        devices: deviceTypesFiltered,
      },
    ],
    [attributeClassesFiltered, deviceTypesFiltered, personAttributesFiltered, segmentsFiltered]
  );

  const getAllTabContent = () => {
    return (
      <>
        {allFiltersFiltered.every((filterArr) => {
          return (
            filterArr.attributes.length === 0 &&
            filterArr.segments.length === 0 &&
            filterArr.devices.length === 0 &&
            filterArr.personAttributes.length === 0
          );
        }) ? (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>{t("ee.advanced_targeting.no_filters_yet")}</p>
          </div>
        ) : null}

        {allFiltersFiltered.map((filters) => {
          return (
            <>
              {filters.attributes.map((attributeClass) => {
                return (
                  <div
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                    onClick={() => {
                      handleAddFilter({
                        type: "attribute",
                        onAddFilter,
                        setOpen,
                        attributeClassName: attributeClass.name,
                      });
                    }}>
                    <TagIcon className="h-4 w-4" />
                    <p>{attributeClass.name}</p>
                  </div>
                );
              })}

              {filters.personAttributes.map((personAttribute) => {
                return (
                  <div
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                    onClick={() => {
                      handleAddFilter({
                        type: "person",
                        onAddFilter,
                        setOpen,
                      });
                    }}>
                    <FingerprintIcon className="h-4 w-4" />
                    <p>{personAttribute.name}</p>
                  </div>
                );
              })}

              {filters.segments.map((segment) => {
                return (
                  <div
                    className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                    onClick={() => {
                      handleAddFilter({
                        type: "segment",
                        onAddFilter,
                        setOpen,
                        segmentId: segment.id,
                      });
                    }}>
                    <Users2Icon className="h-4 w-4" />
                    <p>{segment.title}</p>
                  </div>
                );
              })}

              {filters.devices.map((deviceType) => (
                <div
                  className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                  key={deviceType.id}
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
        {segmentsFiltered.length === 0 && (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>{t("ee.advanced_targeting.no_segments_yet")}</p>
          </div>
        )}
        {segmentsFiltered
          .filter((segment) => !segment.isPrivate)
          .map((segment) => {
            return (
              <div
                className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
                onClick={() => {
                  handleAddFilter({
                    type: "segment",
                    onAddFilter,
                    setOpen,
                    segmentId: segment.id,
                  });
                }}>
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
            className="flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"
            key={deviceType.id}
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
      className="sm:w-[650px] sm:max-w-full"
      closeOnOutsideClick
      hideCloseButton
      open={open}
      setOpen={setOpen}>
      <div className="flex w-auto flex-col">
        <Input
          autoFocus
          onChange={(e) => {
            setSearchValue(e.target.value);
          }}
          placeholder="Browse filters..."
        />
        <TabBar activeId={activeTabId} className="bg-white" setActiveId={setActiveTabId} tabs={tabs} />
      </div>

      <div className={cn("mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto")}>
        <TabContent />
      </div>
    </Modal>
  );
}
