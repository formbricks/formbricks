import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { cn } from "@formbricks/lib/cn";
import { Survey } from "@formbricks/types/surveys";
import {
  TBaseFilterGroup,
  TUserSegmentFilter,
  convertOperatorToText,
  convertMetricToText,
  ATTRIBUTE_OPERATORS,
  BASE_OPERATORS,
  TUserSegmentFilterValue,
  TBaseFilterGroupItem,
} from "@formbricks/types/v1/userSegment";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  TabBar,
} from "@formbricks/ui";
import { createId } from "@paralleldrive/cuid2";
import { MousePointerClick, TagIcon, Users2Icon, MonitorSmartphoneIcon, PlusCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { produce, original } from "immer";

const isResourceFilter = (
  resource: TUserSegmentFilter | TBaseFilterGroup
): resource is TUserSegmentFilter => {
  return (resource as TUserSegmentFilter).root !== undefined;
};

type TConnector = "and" | "or" | null;
type SegmentFilterItemProps = {
  connector: TConnector;
  resource: TUserSegmentFilter;
  environmentId: string;
  onFilterValueChange: (filterId: string, newValue: TUserSegmentFilterValue) => void;
  onAddFilterBelow: (filterId: string) => void;
  onCreateGroup: (filterId: string) => void;
};

const SegmentFilterItem = ({
  resource,
  connector,
  environmentId,
  onFilterValueChange,
  onAddFilterBelow,
  onCreateGroup,
}: SegmentFilterItemProps) => {
  const [connectorState, setConnectorState] = useState(connector);
  const [valueInput, setValueInput] = useState(resource.value.toString());
  const [userSegmentOperator, setUserSegmentOperator] = useState(
    resource.root.type === "segment" ? resource.qualifier.operator : ""
  );
  const [selectedOperator, setSelectedOperator] = useState(resource.qualifier.operator);

  const { attributeClasses } = useAttributeClasses(environmentId);
  const { eventClasses } = useEventClasses(environmentId);

  const onConnectorChange = () => {
    if (!connectorState) return;

    if (connectorState === "and") {
      setConnectorState("or");
      return;
    }

    setConnectorState("and");
  };

  // action UI

  if (resource.root.type === "action") {
    const operatorText = convertOperatorToText(selectedOperator);

    const eventClass = eventClasses.find((eventClass) => eventClass.id === resource.root.actionTypeId)?.name;
    const operatorArr = BASE_OPERATORS.map((operator) => {
      return {
        id: operator,
        name: convertOperatorToText(operator),
      };
    });

    let qualifierMetric: string = "";

    if ("metric" in resource.qualifier) {
      qualifierMetric = convertMetricToText(resource.qualifier.metric);
    }

    return (
      <div className="flex items-center gap-4 text-sm">
        <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
          {!!connectorState ? connectorState : "Where"}
        </span>

        <Select value={eventClass}>
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <MousePointerClick className="h-4 w-4 text-sm" />
              <p>{eventClass}</p>
            </div>
          </SelectTrigger>

          <SelectContent>
            {eventClasses.map((eventClass) => (
              <SelectItem value={eventClass.id}>{eventClass.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!!qualifierMetric && (
          <Select value={qualifierMetric}>
            <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
              <p>{qualifierMetric}</p>
            </SelectTrigger>
          </Select>
        )}

        <Select value={operatorText}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>
        </Select>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // attribute UI

  if (resource.root.type === "attribute") {
    const operatorText = convertOperatorToText(selectedOperator);

    const attributeClass = attributeClasses.find(
      (attributeClass) => attributeClass.id === resource.root.attributeClassId
    )?.name;
    const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
      return {
        id: operator,
        name: convertOperatorToText(operator),
      };
    });

    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="w-[40px]">
          <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
            {!!connectorState ? connectorState : "Where"}
          </span>
        </div>

        <Select value={attributeClass}>
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <TagIcon className="h-4 w-4 text-sm" />
              <p>{attributeClass}</p>
            </div>
          </SelectTrigger>

          <SelectContent>
            {attributeClasses
              .filter((attributeClass) => !attributeClass.archived)
              .map((attributeClass) => (
                <SelectItem value={attributeClass.id}>{attributeClass.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select
          value={operatorText}
          onValueChange={(operator) => {
            setSelectedOperator(operator);
          }}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>

          <SelectContent>
            {operatorArr.map((operator) => (
              <SelectItem value={operator.id}>{operator.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={valueInput}
          onChange={(e) => {
            setValueInput(e.target.value);

            onFilterValueChange(
              // localSegment.findIndex((group) => group.resource === resource),
              resource.id,
              e.target.value
            );
          }}
          className="w-auto"
        />

        <Button size="sm" onClick={() => onAddFilterBelow(resource.id)}>
          AFB
        </Button>

        <Button size="sm" onClick={() => onCreateGroup(resource.id)}>
          CG
        </Button>

        {/* <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select> */}
      </div>
    );
  }

  // segment UI

  if (resource.root.type === "segment") {
    const onSegmentChange = () => {
      if (!userSegmentOperator) return;

      if (userSegmentOperator === "userIsIn") {
        setUserSegmentOperator("userIsNotIn");
        return;
      }

      setUserSegmentOperator("userIsIn");
    };

    return (
      <div className="flex items-center gap-4">
        {/* Connector */}
        <span
          className={cn(!!connectorState && "cursor-pointer text-sm underline")}
          onClick={onConnectorChange}>
          {!!connectorState ? connectorState : "Where"}
        </span>

        {/* Segment */}
        <span className={cn("cursor-pointer text-sm underline")} onClick={onSegmentChange}>
          {convertOperatorToText(userSegmentOperator)}
        </span>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <Users2Icon className="h-4 w-4" />
              <p>{resource.value}</p>
            </div>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  if (resource.root.type === "device") {
    const deviceType = resource.root.deviceType;
    const operatorText = convertOperatorToText(resource.qualifier.operator);

    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="w-[40px]">
          <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
            {!!connectorState ? connectorState : "Where"}
          </span>
        </div>

        <Select value="device">
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <MonitorSmartphoneIcon className="h-4 w-4 text-sm" />
              <p>Device</p>
            </div>
          </SelectTrigger>
        </Select>

        <Select value={operatorText}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>
        </Select>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select>
      </div>
    );
  }
};

const SegmentFilters = ({
  group,
  environmentId,
  localSurvey,
  setLocalSurvey,
}: {
  group: TBaseFilterGroup;
  environmentId: string;
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [activeTabId, setActiveId] = useState<string>("all");

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

  const handleFilterValuechange = (filterId: string, newValue: TUserSegmentFilterValue) => {
    const searchAndUpdate = (group: TBaseFilterGroup) => {
      const clonedGroup = [...group];
      clonedGroup.forEach((filterGroup) => {
        if (isResourceFilter(filterGroup.resource)) {
          if (filterGroup.resource.id === filterId) {
            filterGroup.resource.value = newValue;
            return;
          }
        } else {
          searchAndUpdate(filterGroup.resource);
        }
      });

      return clonedGroup;
    };

    const updatedLocalSurvey = { ...localSurvey };
    if (updatedLocalSurvey?.userSegment?.filters) {
      const clonedUpdatedsurvey = searchAndUpdate(updatedLocalSurvey.userSegment.filters);
      updatedLocalSurvey.userSegment.filters = clonedUpdatedsurvey;
    }

    setLocalSurvey(updatedLocalSurvey);
  };

  const handleAddFilterBelow = (filterId: string, groupIndex: number | null = null) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup): TBaseFilterGroup => {
        for (let i = 0; i < group.length; i++) {
          const filterGroup = group[i];
          if (isResourceFilter(filterGroup.resource)) {
            if (filterGroup.resource.id === filterId) {
              const newFilter = {
                id: createId(),
                root: { type: "attribute", attributeClassId: "" },
                qualifier: { operator: "endsWith" },
                value: "",
              };

              try {
                const debug = original(group);
                debug?.splice(i + 1, 0, { id: createId(), resource: newFilter, connector: "and" });
                console.log(debug);
              } catch (err) {
                console.log(err);
              }

              group.splice(i + 1, 0, { id: createId(), resource: newFilter, connector: "and" });
            }
          } else if (groupIndex !== null && groupIndex === i) {
            const newFilter = {
              id: createId(),
              connector: "and",
              resource: {
                id: createId(),
                root: { type: "attribute", attributeClassId: "" },
                qualifier: { operator: "endsWith" },
                value: "",
              },
            };

            group.splice(i + 1, 0, newFilter, ...(group[i + 1] ? [group[i + 1]] : []));
          } else {
            filterGroup.resource = searchAndUpdate(filterGroup.resource);
          }
        }

        return group;
      };

      if (draft.userSegment?.filters) {
        draft.userSegment.filters = searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const handleCreateGroup = (filterId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const recurse = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const filterGroup = group[i];
          if (isResourceFilter(filterGroup.resource)) {
            if (filterGroup.resource.id === filterId) {
              const newFilter: TUserSegmentFilter = {
                id: createId(),
                root: { type: "attribute", attributeClassId: "" },
                qualifier: { operator: "endsWith" },
                value: "",
              };

              const newGroupToAdd: TBaseFilterGroupItem = {
                id: createId(),
                connector: filterGroup.connector,
                resource: [
                  filterGroup,
                  {
                    id: createId(),
                    connector: "and",
                    resource: newFilter,
                  },
                ],
              };

              group.splice(i, 1, newGroupToAdd);
            }
          } else {
            recurse(filterGroup.resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        recurse(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  // const handleCreateGroup = (filterId: string) => {
  //   const searchAndUpdate = (group: TBaseFilterGroup): TBaseFilterGroup => {
  //     return group.map((filterGroup, i) => {
  //       if (isResourceFilter(filterGroup.resource)) {
  //         if (filterGroup.resource.id === filterId) {
  //           const newFilter = {
  //             connector: "and",
  //             resource: {
  //               root: { type: "attribute", attributeClassId: "" },
  //               qualifier: { operator: "endsWith" },
  //               value: "",
  //             },
  //           };

  //           const newNestedGroup = [{ connector: null, resource: filterGroup.resource }, newFilter];

  //           return {
  //             connector: filterGroup.connector,
  //             resource: newNestedGroup,
  //           };
  //         }
  //       } else {
  //         return {
  //           ...filterGroup,
  //           resource: searchAndUpdate(filterGroup.resource),
  //         };
  //       }

  //       return filterGroup;
  //     });
  //   };

  //   const updatedLocalSurvey = {
  //     ...localSurvey,
  //     userSegment: {
  //       ...localSurvey.userSegment,
  //       filters: searchAndUpdate(localSurvey.userSegment.filters),
  //     },
  //   };

  //   setLocalSurvey(updatedLocalSurvey);
  // };

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {group?.map((groupItem, groupIndex) => {
        const { connector, resource } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <SegmentFilterItem
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              onFilterValueChange={(filterId: string, newValue: string | number) =>
                handleFilterValuechange(filterId, newValue)
              }
              onAddFilterBelow={(filterId: string) => handleAddFilterBelow(filterId)}
              onCreateGroup={(filterId: string) => handleCreateGroup(filterId)}
            />
          );
        } else {
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <span className="cursor-pointer text-sm underline">{!!connector ? connector : "Where"}</span>
                <div className="rounded-lg border-2 border-slate-300 p-4">
                  <SegmentFilters
                    group={resource}
                    environmentId={environmentId}
                    localSurvey={localSurvey}
                    setLocalSurvey={setLocalSurvey}
                  />
                </div>
              </div>
              <Button size="sm" className="w-fit" onClick={() => handleAddFilterBelow("", groupIndex)}>
                AFB
              </Button>
            </div>
          );
        }
      })}

      <Dialog open={addFilterModalOpen} onOpenChange={(open) => setAddFilterModalOpen(open)}>
        <DialogTrigger className="max-w-[160px]">
          <button className="flex items-center gap-2 text-sm">
            <PlusCircleIcon className="h-4 w-4" />
            <p>Add filter</p>
          </button>
        </DialogTrigger>

        <DialogContent className="w-[600px] bg-slate-100 sm:max-w-2xl" hideCloseButton>
          <div className="flex w-auto flex-col">
            <Input placeholder="Browse filters..." autoFocus />

            <TabBar
              className="bg-slate-100"
              tabs={tabs}
              activeId={activeTabId}
              setActiveId={setActiveId}></TabBar>
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
                        setLocalSurvey((prev) => {
                          return {
                            ...prev,
                            userSegment: {
                              ...prev.userSegment,
                              filters: [
                                ...prev.userSegment.filters,
                                {
                                  connector: null,
                                  resource: {
                                    root: {
                                      type: "attribute",
                                      attributeClassId: attributeClass.id,
                                    },
                                    qualifier: {
                                      operator: "equals",
                                    },
                                    value: "",
                                  },
                                },
                              ],
                            },
                          };
                        });

                        setAddFilterModalOpen(false);
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
    </div>
  );
};

export default SegmentFilters;
