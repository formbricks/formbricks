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
  TUserSegmentConnector,
  TUserSegmentAttributeFilter,
  TAttributeOperator,
  TUserSegmentActionFilter,
  TBaseOperator,
  ACTION_METRICS,
  TActionMetric,
} from "@formbricks/types/v1/userSegment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TabBar,
} from "@formbricks/ui";
import { createId } from "@paralleldrive/cuid2";
import {
  MousePointerClick,
  TagIcon,
  Users2Icon,
  MonitorSmartphoneIcon,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { produce } from "immer";
import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";

// type guard to check if the resource is a filter or a filter group
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
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  onAddFilterBelow: (filterId: string) => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
};

const SegmentFilterItemConnector = ({
  connector,
  localSurvey,
  setLocalSurvey,
  filterId,
}: {
  connector: TUserSegmentConnector;
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  filterId: string;
}) => {
  const updateLocalSurvey = (newConnector: TUserSegmentConnector) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              group[i].connector = newConnector;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const onConnectorChange = () => {
    if (!connector) return;

    if (connector === "and") {
      updateLocalSurvey("or");
    } else {
      updateLocalSurvey("and");
    }
  };

  return (
    <div className="w-[40px]">
      <span className={cn(!!connector && "cursor-pointer underline")} onClick={onConnectorChange}>
        {!!connector ? connector : "Where"}
      </span>
    </div>
  );
};

type TAttributeSegmentFilterProps = SegmentFilterItemProps & {
  resource: TUserSegmentAttributeFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TUserSegmentFilterValue) => void;
};
const AttributeSegmentFilter = ({
  environmentId,
  connector,
  resource,
  localSurvey,
  setLocalSurvey,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
}: TAttributeSegmentFilterProps) => {
  const { attributeClassId } = resource.root;
  const { attributeClasses } = useAttributeClasses(environmentId);
  const operatorText = convertOperatorToText(resource.qualifier.operator);

  const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const attributeClass = attributeClasses.find(
    (attributeClass) => attributeClass.id === attributeClassId
  )?.name;

  const updateOperatorInLocalSurvey = (filterId: string, newOperator: TAttributeOperator) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              resource.qualifier.operator = newOperator;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const updateAttributeClassIdInLocalSurvey = (filterId: string, newAttributeClassId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              (resource as TUserSegmentAttributeFilter).root.attributeClassId = newAttributeClassId;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />

      <Select
        value={attributeClass}
        onValueChange={(value) => {
          updateAttributeClassIdInLocalSurvey(resource.id, value);
        }}>
        <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
          <SelectValue />
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
        onValueChange={(operator: TAttributeOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}>
        <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
          <SelectValue className="hidden" />
          <p>{operatorText}</p>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={resource.value.toString()}
        onChange={(e) => {
          updateValueInLocalSurvey(resource.id, e.target.value);
        }}
        className="w-auto"
      />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onAddFilterBelow(resource.id)}>
              add filter below
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onCreateGroup(resource.id)}>create group</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveFilter(resource.id, "up")}>move up</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveFilter(resource.id, "down")}>move down</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button onClick={() => onDeleteFilter(resource.id)}>
          <Trash2 className="h-4 w-4 cursor-pointer"></Trash2>
        </button>
      </div>
    </div>
  );
};

type TActionSegmentFilterProps = SegmentFilterItemProps & {
  resource: TUserSegmentActionFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TUserSegmentFilterValue) => void;
};
const ActionSegmentFilter = ({
  environmentId,
  connector,
  resource,
  localSurvey,
  setLocalSurvey,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
}: TActionSegmentFilterProps) => {
  const { actionClassId } = resource.root;
  const { eventClasses } = useEventClasses(environmentId);
  const operatorText = convertOperatorToText(resource.qualifier.operator);
  const qualifierMetric = resource.qualifier.metric;

  const operatorArr = BASE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator),
  }));

  const actionMetrics = ACTION_METRICS.map((metric) => ({
    id: metric,
    name: convertMetricToText(metric),
  }));

  const attributeClass = eventClasses.find((eventClass) => eventClass.id === actionClassId)?.name;

  const updateOperatorInLocalSurvey = (filterId: string, newOperator: TBaseOperator) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              resource.qualifier.operator = newOperator;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const updateActionClassIdInLocalSurvey = (filterId: string, actionClassId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              (resource as TUserSegmentActionFilter).root.actionClassId = actionClassId;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const updateActionMetricInLocalSurvey = (filterId: string, newMetric: TActionMetric) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              (resource as TUserSegmentActionFilter).qualifier.metric = newMetric;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />

      <Select
        value={attributeClass}
        onValueChange={(value) => {
          updateActionClassIdInLocalSurvey(resource.id, value);
        }}>
        <SelectTrigger className="w-[210px] items-center justify-center capitalize" hideArrow>
          <SelectValue />
          <div className="flex items-center gap-1">
            <MousePointerClick className="h-4 w-4 text-sm" />
            <p>{attributeClass}</p>
          </div>
        </SelectTrigger>
        <SelectContent className="bottom-0">
          {eventClasses
            .filter((eventClass) => !eventClass.archived)
            .map((eventClass) => (
              <SelectItem value={eventClass.id}>{eventClass.name}</SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={qualifierMetric}
        onValueChange={(value: TActionMetric) => {
          updateActionMetricInLocalSurvey(resource.id, value);
        }}>
        <SelectTrigger className="flex w-[210px] items-center justify-center capitalize" hideArrow>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {actionMetrics.map((metric) => (
            <SelectItem value={metric.id}>{metric.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={operatorText}
        onValueChange={(operator: TBaseOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}>
        <SelectTrigger className="flex w-full max-w-[40px] items-center justify-center text-center" hideArrow>
          <SelectValue />
          <p>{operatorText}</p>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={resource.value.toString()}
        onChange={(e) => {
          updateValueInLocalSurvey(resource.id, e.target.value);
        }}
        className="w-auto"
      />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onAddFilterBelow(resource.id)}>
              add filter below
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onCreateGroup(resource.id)}>create group</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveFilter(resource.id, "up")}>move up</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveFilter(resource.id, "down")}>move down</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button onClick={() => onDeleteFilter(resource.id)}>
          <Trash2 className="h-4 w-4 cursor-pointer"></Trash2>
        </button>
      </div>
    </div>
  );
};

type AddNewFilterItemProps = {
  environmentId: string;
  connector: TUserSegmentConnector;
  filterId: string;
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
};
const AddNewFilterItem = ({
  connector,
  filterId,
  environmentId,
  localSurvey,
  setLocalSurvey,
}: AddNewFilterItemProps) => {
  const [activeTabId, setActiveId] = useState("actions");
  const { attributeClasses } = useAttributeClasses(environmentId);
  const { eventClasses } = useEventClasses(environmentId);

  const tabs = [
    { id: "actions", label: "Actions" },
    { id: "attributes", label: "Attributes" },
  ];

  const onAddFilter = (filter: TUserSegmentFilter) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              resource.qualifier = filter.qualifier;
              resource.root = filter.root;
              resource.value = filter.value;

              resource.isPlaceholder = false;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <SegmentFilterItemConnector
        connector={connector}
        filterId={filterId}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />
      <Popover>
        <PopoverTrigger>
          <div className="rounded-md bg-slate-200 p-2 text-slate-600 hover:border hover:border-slate-500">
            <span>Select filter...</span>
          </div>
        </PopoverTrigger>

        <PopoverContent className="bg-slate-50">
          <div className="flex flex-col gap-4">
            <TabBar activeId={activeTabId} setActiveId={setActiveId} tabs={tabs} />

            <div className="max-h-96 overflow-auto">
              {activeTabId === "actions" && (
                <div className="flex flex-col gap-4">
                  {eventClasses.map((eventClass) => (
                    <div
                      className="flex cursor-pointer items-center gap-2"
                      onClick={() => {
                        const filter: TUserSegmentFilter = {
                          id: "sample",
                          root: {
                            type: "action",
                            actionClassId: eventClass.id,
                          },
                          qualifier: {
                            metric: "occuranceCount",
                            operator: "equals",
                          },
                          value: "",
                        };

                        onAddFilter(filter);
                      }}>
                      <MousePointerClick className="h-4 w-4" />
                      <span>{eventClass.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTabId === "attributes" && (
                <div className="flex flex-col gap-4">
                  {attributeClasses.map((attributeClass) => (
                    <div
                      className="flex cursor-pointer items-center gap-2"
                      onClick={() => {
                        const filter: TUserSegmentFilter = {
                          id: "sample",
                          root: {
                            type: "attribute",
                            attributeClassId: attributeClass.id,
                          },
                          qualifier: {
                            operator: "equals",
                          },
                          value: "",
                        };

                        onAddFilter(filter);
                      }}>
                      <MousePointerClick className="h-4 w-4" />
                      <span>{attributeClass.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const SegmentFilterItem = ({
  resource,
  connector,
  environmentId,
  localSurvey,
  setLocalSurvey,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
}: SegmentFilterItemProps) => {
  const [connectorState, setConnectorState] = useState(connector);
  const [userSegmentOperator, setUserSegmentOperator] = useState(
    resource.root.type === "segment" ? resource.qualifier.operator : ""
  );

  const updateFilterValueInLocalSurvey = (filterId: string, newValue: string | number) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              resource.value = newValue;

              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const onConnectorChange = () => {
    if (!connectorState) return;

    if (connectorState === "and") {
      setConnectorState("or");
      return;
    }

    setConnectorState("and");
  };

  if ((resource as TUserSegmentFilter).isPlaceholder) {
    return (
      <AddNewFilterItem
        environmentId={environmentId}
        connector={connector}
        filterId={resource.id}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />
    );
  }

  // action UI

  if (resource.root.type === "action") {
    return (
      <ActionSegmentFilter
        connector={connector}
        resource={resource as TUserSegmentActionFilter}
        environmentId={environmentId}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        updateValueInLocalSurvey={updateFilterValueInLocalSurvey}
      />
    );
  }

  // attribute UI

  if (resource.root.type === "attribute") {
    return (
      <AttributeSegmentFilter
        connector={connector}
        resource={resource as TUserSegmentAttributeFilter}
        environmentId={environmentId}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        updateValueInLocalSurvey={updateFilterValueInLocalSurvey}
      />
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

  const handleAddFilterBelow = (resourceId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === resourceId) {
              const newFilter: TUserSegmentFilter = {
                id: createId(),
                root: { type: "attribute", attributeClassId: "" },
                qualifier: { operator: "endsWith" },
                value: "",
                isPlaceholder: true,
              };

              group.splice(i + 1, 0, { id: createId(), resource: newFilter, connector: "and" });
              break;
            }
          } else {
            // resource is a filter group

            if (group[i].id === resourceId) {
              const newFilter: TBaseFilterGroupItem = {
                id: createId(),
                connector: "and",
                resource: {
                  id: createId(),
                  root: { type: "attribute", attributeClassId: "" },
                  qualifier: { operator: "endsWith" },
                  value: "",
                  isPlaceholder: true,
                },
              };

              group.splice(i + 1, 0, newFilter);
              break;
            } else {
              searchAndUpdate(resource);
            }
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const handleCreateGroup = (resourceId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndCreateGroup = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const filterGroup = group[i];
          if (isResourceFilter(filterGroup.resource)) {
            if (filterGroup.resource.id === resourceId) {
              const newFilter: TUserSegmentFilter = {
                id: createId(),
                root: { type: "attribute", attributeClassId: "" },
                qualifier: { operator: "endsWith" },
                value: "",
                isPlaceholder: true,
              };

              const newGroupToAdd: TBaseFilterGroupItem = {
                id: createId(),
                connector: filterGroup.connector,
                resource: [
                  {
                    ...filterGroup,
                    connector: null,
                  },
                  {
                    id: createId(),
                    connector: "and",
                    resource: newFilter,
                  },
                ],
              };

              group.splice(i, 1, newGroupToAdd);

              break;
            }
          } else {
            if (group[i].id === resourceId) {
              // make an outer group, wrap the current group in it and add a filter below it

              const newFilter: TBaseFilterGroupItem = {
                id: createId(),
                connector: "and",
                resource: {
                  id: createId(),
                  root: { type: "attribute", attributeClassId: "" },
                  qualifier: { operator: "endsWith" },
                  value: "",
                  isPlaceholder: true,
                },
              };

              const outerGroup: TBaseFilterGroupItem = {
                connector: filterGroup.connector,
                id: createId(),
                resource: [{ ...filterGroup, connector: null }, newFilter],
              };

              group.splice(i, 1, outerGroup);

              break;
            } else {
              searchAndCreateGroup(filterGroup.resource);
            }
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndCreateGroup(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const handleMoveResource = (resourceId: string, direction: "up" | "down") => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const moveUp = (group: TBaseFilterGroup, i: number) => {
        if (i === 0) {
          return;
        }

        const previousTemp = group[i - 1];

        group[i - 1] = group[i];
        group[i] = previousTemp;

        if (i - 1 === 0) {
          const newConnector = group[i - 1].connector;

          group[i - 1].connector = null;
          group[i].connector = newConnector;
        }
      };

      const moveDown = (group: TBaseFilterGroup, i: number) => {
        if (i === group.length - 1) {
          return;
        }

        const temp = group[i + 1];
        group[i + 1] = group[i];
        group[i] = temp;

        // after the swap, determine if the connector should be null or not
        if (i === 0) {
          const nextConnector = group[i].connector;

          group[i].connector = null;
          group[i + 1].connector = nextConnector;
        }
      };

      const searchAndMove = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === resourceId) {
              if (direction === "up") {
                moveUp(group, i);
                break;
              } else {
                moveDown(group, i);
                break;
              }
            }
          } else {
            if (group[i].id === resourceId) {
              if (direction === "up") {
                moveUp(group, i);
                break;
              } else {
                moveDown(group, i);
                break;
              }
            }

            searchAndMove(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndMove(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const handleDeleteResource = (resourceId: string) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const deleteResource = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource) && resource.id === resourceId) {
            group.splice(i, 1);

            if (group.length) {
              group[0].connector = null;
            }

            break;
          } else if (!isResourceFilter(resource) && group[i].id === resourceId) {
            group.splice(i, 1);

            if (group.length) {
              group[0].connector = null;
            }

            break;
          } else if (!isResourceFilter(resource)) {
            deleteResource(resource);
          }
        }
      };

      const deleteEmptyGroups = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (!isResourceFilter(resource) && resource.length === 0) {
            group.splice(i, 1);
          } else if (!isResourceFilter(resource)) {
            deleteEmptyGroups(resource);
          }
        }
      };

      if (draft.userSegment?.filters) {
        deleteResource(draft.userSegment.filters);

        // check if there are any empty groups and delete them
        deleteEmptyGroups(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const toggleGroupConnector = (groupId: string, newConnectorValue: TUserSegmentConnector) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];
          if (!isResourceFilter(resource)) {
            if (group[i].id === groupId) {
              group[i].connector = newConnectorValue;
              break;
            } else {
              searchAndUpdate(resource);
            }
          }
        }
      };

      if (draft.userSegment?.filters) {
        searchAndUpdate(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  const onConnectorChange = (groupId: string, connector: TUserSegmentConnector) => {
    if (!connector) return;

    if (connector === "and") {
      toggleGroupConnector(groupId, "or");
    } else {
      toggleGroupConnector(groupId, "and");
    }
  };

  const handleAddFilterInGroup = (groupId: string, filter: TBaseFilterGroupItem) => {
    const updatedLocalSurvey = produce(localSurvey, (draft) => {
      const addFilter = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            continue;
          } else {
            if (group[i].id === groupId) {
              const { resource } = group[i];

              if (!isResourceFilter(resource)) {
                if (resource.length === 0) {
                  resource.push({
                    ...filter,
                    connector: null,
                  });
                } else {
                  resource.push(filter);
                }
              }

              break;
            } else {
              addFilter(resource);
            }
          }
        }
      };

      if (draft.userSegment?.filters) {
        addFilter(draft.userSegment.filters);
      }
    });

    setLocalSurvey(updatedLocalSurvey);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {group?.map((groupItem) => {
        const { connector, resource, id: groupId } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <SegmentFilterItem
              key={groupId}
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              onAddFilterBelow={(filterId: string) => handleAddFilterBelow(filterId)}
              onCreateGroup={(filterId: string) => handleCreateGroup(filterId)}
              onDeleteFilter={(filterId: string) => handleDeleteResource(filterId)}
              onMoveFilter={(filterId: string, direction: "up" | "down") =>
                handleMoveResource(filterId, direction)
              }
            />
          );
        } else {
          return (
            <div key={groupId} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <div key={connector} className="w-[40px]">
                  <span
                    className={cn(!!connector && "cursor-pointer underline")}
                    onClick={() => onConnectorChange(groupId, connector)}>
                    {!!connector ? connector : "Where"}
                  </span>
                </div>

                <div className="rounded-lg border-2 border-slate-300 p-4">
                  <SegmentFilters
                    group={resource}
                    environmentId={environmentId}
                    localSurvey={localSurvey}
                    setLocalSurvey={setLocalSurvey}
                  />

                  <AddFilterModal
                    environmentId={environmentId}
                    open={addFilterModalOpen}
                    setOpen={setAddFilterModalOpen}
                    onAddFilter={(filter) => handleAddFilterInGroup(groupId, filter)}
                  />
                </div>

                <div className="flex items-center gap-2 p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleAddFilterBelow(groupId)}>
                        add filter below
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleCreateGroup(groupId)}>
                        create group
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleMoveResource(groupId, "up")}>
                        move up
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleMoveResource(groupId, "down")}>
                        move down
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button onClick={() => handleDeleteResource(groupId)}>
                    <Trash2 className="h-4 w-4 cursor-pointer" />
                  </button>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default SegmentFilters;
