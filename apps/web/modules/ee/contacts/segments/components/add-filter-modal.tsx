"use client";

import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { Modal } from "@/modules/ui/components/modal";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { FingerprintIcon, MonitorSmartphoneIcon, TagIcon, Users2Icon } from "lucide-react";
import React, { type JSX, useMemo, useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type {
  TBaseFilter,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";

interface TAddFilterModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddFilter: (filter: TBaseFilter) => void;
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
}

type TFilterType = "attribute" | "segment" | "device" | "person";

const handleAddFilter = ({
  type,
  onAddFilter,
  setOpen,
  contactAttributeKey,
  deviceType,
  segmentId,
}: {
  type: TFilterType;
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
  contactAttributeKey?: string;
  segmentId?: string;
  deviceType?: string;
}): void => {
  if (type === "attribute") {
    if (!contactAttributeKey) return;

    const newFilterResource: TSegmentAttributeFilter = {
      id: createId(),
      root: {
        type,
        contactAttributeKey,
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
  contactAttributeKeys: TContactAttributeKey[];
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
}

// Reusable FilterButton component to remove duplicated button code
function FilterButton({
  icon,
  label,
  onClick,
  onKeyDown,
  tabIndex = 0,
  className = "",
  ...props
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  className?: string;
  [key: string]: any;
}) {
  return (
    <button
      className={`flex cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 ${className}`}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...props}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AttributeTabContent({ contactAttributeKeys, onAddFilter, setOpen }: AttributeTabContentProps) {
  const { t } = useTranslate();

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-medium">{t("common.person")}</h2>
        <div>
          <FilterButton
            data-testid="filter-btn-person-userId"
            icon={<FingerprintIcon className="h-4 w-4" />}
            label={t("common.user_id")}
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
            }}
          />
        </div>
      </div>

      <hr className="my-2" />

      <div>
        <h2 className="text-base font-medium">{t("common.attributes")}</h2>
      </div>
      {contactAttributeKeys.length === 0 && (
        <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
          <p>{t("environments.segments.no_attributes_yet")}</p>
        </div>
      )}
      {contactAttributeKeys.map((attributeKey) => (
        <FilterButton
          key={attributeKey.id}
          data-testid={`filter-btn-attribute-${attributeKey.key}`}
          icon={<TagIcon className="h-4 w-4" />}
          label={attributeKey.name ?? attributeKey.key}
          onClick={() => {
            handleAddFilter({
              type: "attribute",
              onAddFilter,
              setOpen,
              contactAttributeKey: attributeKey.key,
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleAddFilter({
                type: "attribute",
                onAddFilter,
                setOpen,
                contactAttributeKey: attributeKey.key,
              });
            }
          }}
        />
      ))}
    </div>
  );
}

export function AddFilterModal({
  onAddFilter,
  open,
  setOpen,
  contactAttributeKeys,
  segments,
}: TAddFilterModalProps) {
  const [activeTabId, setActiveTabId] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const { t } = useTranslate();
  const tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { id: "all", label: t("common.all") },
    {
      id: "attributes",
      label: t("environments.segments.person_and_attributes"),
      icon: <TagIcon className="h-4 w-4" />,
    },
    { id: "segments", label: t("common.segments"), icon: <Users2Icon className="h-4 w-4" /> },
    {
      id: "devices",
      label: t("environments.segments.devices"),
      icon: <MonitorSmartphoneIcon className="h-4 w-4" />,
    },
  ];

  const devices = useMemo(
    () => [
      { id: "phone", name: t("environments.segments.phone") },
      { id: "desktop", name: t("environments.segments.desktop") },
    ],
    []
  );

  const contactAttributeKeysFiltered = useMemo(() => {
    if (!contactAttributeKeys) return [];

    if (!searchValue) return contactAttributeKeys;

    return contactAttributeKeys.filter((attributeKey) => {
      const attributeValueToSeach = attributeKey.name ?? attributeKey.key;
      return attributeValueToSeach.toLowerCase().includes(searchValue.toLowerCase());
    });
  }, [contactAttributeKeys, searchValue]);

  const contactAttributeFiltered = useMemo(() => {
    const contactAttributes = [{ name: "userId" }];

    return contactAttributes.filter((ca) => ca.name.toLowerCase().includes(searchValue.toLowerCase()));
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
        attributes: contactAttributeKeysFiltered,
        contactAttributeFiltered,
        segments: segmentsFiltered,
        devices: deviceTypesFiltered,
      },
    ],
    [contactAttributeKeysFiltered, deviceTypesFiltered, contactAttributeFiltered, segmentsFiltered]
  );

  const getAllTabContent = () => {
    return (
      <>
        {allFiltersFiltered.every((filterArr) => {
          return (
            filterArr.attributes.length === 0 &&
            filterArr.segments.length === 0 &&
            filterArr.devices.length === 0 &&
            filterArr.contactAttributeFiltered.length === 0
          );
        }) ? (
          <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
            <p>{t("environments.segments.no_filters_yet")}</p>
          </div>
        ) : null}

        {allFiltersFiltered.map((filters, index) => (
          <div key={index}>
            {filters.attributes.map((attributeKey) => (
              <FilterButton
                key={attributeKey.id}
                data-testid={`filter-btn-attribute-${attributeKey.key}`}
                icon={<TagIcon className="h-4 w-4" />}
                label={attributeKey.name ?? attributeKey.key}
                onClick={() => {
                  handleAddFilter({
                    type: "attribute",
                    onAddFilter,
                    setOpen,
                    contactAttributeKey: attributeKey.key,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddFilter({
                      type: "attribute",
                      onAddFilter,
                      setOpen,
                      contactAttributeKey: attributeKey.key,
                    });
                  }
                }}
              />
            ))}

            {filters.contactAttributeFiltered.map((personAttribute) => (
              <FilterButton
                key={personAttribute.name}
                data-testid={`filter-btn-person-${personAttribute.name}`}
                icon={<FingerprintIcon className="h-4 w-4" />}
                label={personAttribute.name}
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
                }}
              />
            ))}

            {filters.segments.map((segment) => (
              <FilterButton
                key={segment.id}
                data-testid={`filter-btn-segment-${segment.id}`}
                icon={<Users2Icon className="h-4 w-4" />}
                label={segment.title}
                onClick={() => {
                  handleAddFilter({
                    type: "segment",
                    onAddFilter,
                    setOpen,
                    segmentId: segment.id,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddFilter({
                      type: "segment",
                      onAddFilter,
                      setOpen,
                      segmentId: segment.id,
                    });
                  }
                }}
              />
            ))}

            {filters.devices.map((deviceType) => (
              <FilterButton
                key={deviceType.id}
                data-testid={`filter-btn-device-${deviceType.id}`}
                icon={<MonitorSmartphoneIcon className="h-4 w-4" />}
                label={deviceType.name}
                onClick={() => {
                  handleAddFilter({
                    type: "device",
                    onAddFilter,
                    setOpen,
                    deviceType: deviceType.id,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddFilter({
                      type: "device",
                      onAddFilter,
                      setOpen,
                      deviceType: deviceType.id,
                    });
                  }
                }}
              />
            ))}
          </div>
        ))}
      </>
    );
  };

  const getAttributesTabContent = () => {
    return (
      <AttributeTabContent
        contactAttributeKeys={contactAttributeKeysFiltered}
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
            <p>{t("environments.segments.no_segments_yet")}</p>
          </div>
        )}
        {segmentsFiltered
          .filter((segment) => !segment.isPrivate)
          .map((segment) => (
            <FilterButton
              key={segment.id}
              data-testid={`filter-btn-segment-${segment.id}`}
              icon={<Users2Icon className="h-4 w-4" />}
              label={segment.title}
              onClick={() => {
                handleAddFilter({
                  type: "segment",
                  onAddFilter,
                  setOpen,
                  segmentId: segment.id,
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleAddFilter({
                    type: "segment",
                    onAddFilter,
                    setOpen,
                    segmentId: segment.id,
                  });
                }
              }}
            />
          ))}
      </>
    );
  };

  const getDevicesTabContent = () => {
    return (
      <div className="flex flex-col">
        {deviceTypesFiltered.map((deviceType) => (
          <FilterButton
            key={deviceType.id}
            data-testid={`filter-btn-device-${deviceType.id}`}
            icon={<MonitorSmartphoneIcon className="h-4 w-4" />}
            label={deviceType.name}
            onClick={() => {
              handleAddFilter({
                type: "device",
                onAddFilter,
                setOpen,
                deviceType: deviceType.id,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAddFilter({
                  type: "device",
                  onAddFilter,
                  setOpen,
                  deviceType: deviceType.id,
                });
              }
            }}
          />
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
