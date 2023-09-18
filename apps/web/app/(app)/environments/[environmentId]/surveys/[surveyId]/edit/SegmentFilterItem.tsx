import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { TUserSegmentFilterValue } from "@formbricks/types/v1/userSegment";
import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";
import {
  ACTION_METRICS,
  ARITHMETIC_OPERATORS,
  ATTRIBUTE_OPERATORS,
  BASE_OPERATORS,
  DEVICE_OPERATORS,
  TActionMetric,
  TArithmeticOperator,
  TAttributeOperator,
  TBaseFilterGroup,
  TBaseFilterGroupItem,
  TBaseOperator,
  TDeviceOperator,
  TSegmentOperator,
  TUserSegment,
  TUserSegmentActionFilter,
  TUserSegmentAttributeFilter,
  TUserSegmentConnector,
  TUserSegmentDeviceFilter,
  TUserSegmentFilter,
  TUserSegmentSegmentFilter,
  convertMetricToText,
  convertOperatorToText,
  convertOperatorToTitle,
  isResourceFilter,
} from "@formbricks/types/v1/userSegment";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui";

import { produce } from "immer";
import {
  MonitorSmartphoneIcon,
  MoreVertical,
  MousePointerClick,
  TagIcon,
  Trash2,
  Users2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import z from "zod";

type SegmentFilterItemProps = {
  connector: TUserSegmentConnector;
  resource: TUserSegmentFilter;
  environmentId: string;
  userSegment: TUserSegment;
  userSegments: TUserSegment[];
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  setUserSegment: (userSegment: TUserSegment) => void;
  handleAddFilterBelow: (resourceId: string, filter: TBaseFilterGroupItem) => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
};

const SegmentFilterItemConnector = ({
  connector,
  userSegment,
  setUserSegment,
  filterId,
}: {
  connector: TUserSegmentConnector;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
  filterId: string;
}) => {
  const updateLocalSurvey = (newConnector: TUserSegmentConnector) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
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

const SegmentFilterItemContextMenu = ({
  filterId,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
}: {
  filterId: string;
  onAddFilterBelow: () => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
}) => {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAddFilterBelow()}>add filter below</DropdownMenuItem>

          <DropdownMenuItem onClick={() => onCreateGroup(filterId)}>create group</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "up")}>move up</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "down")}>move down</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button onClick={() => onDeleteFilter(filterId)} className="mr-4">
        <Trash2 className="h-4 w-4 cursor-pointer"></Trash2>
      </button>
    </div>
  );
};

type TAttributeSegmentFilterProps = SegmentFilterItemProps & {
  onAddFilterBelow: () => void;
  resource: TUserSegmentAttributeFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TUserSegmentFilterValue) => void;
};

const AttributeSegmentFilter = ({
  environmentId,
  connector,
  resource,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  userSegment,
  setUserSegment,
}: TAttributeSegmentFilterProps) => {
  const { attributeClassId } = resource.root;
  const { attributeClasses, isLoadingAttributeClasses } = useAttributeClasses(environmentId);
  const operatorText = convertOperatorToText(resource.qualifier.operator);

  const [valueError, setValueError] = useState("");

  // when the operator changes, we need to check if the value is valid
  useEffect(() => {
    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(resource.value);

      if (isNumber.success) {
        setValueError("");
      } else {
        setValueError("Value must be a number");
      }
    }
  }, [resource.qualifier, resource.value]);

  if (isLoadingAttributeClasses) {
    return (
      <div className="h-10 w-10">
        <LoadingSpinner />
      </div>
    );
  }

  const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const attributeClass = attributeClasses?.find((attributeClass) => attributeClass?.id === attributeClassId)
    ?.name;

  const updateOperatorInLocalSurvey = (filterId: string, newOperator: TAttributeOperator) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const updateAttributeClassIdInLocalSurvey = (filterId: string, newAttributeClassId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const checkValueAndUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    updateValueInLocalSurvey(resource.id, value);

    if (!value) {
      setValueError("Value cannot be empty");
      return;
    }

    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(value);

      if (isNumber.success) {
        setValueError("");
        updateValueInLocalSurvey(resource.id, parseInt(value, 10));
      } else {
        setValueError("Value must be a number");
        updateValueInLocalSurvey(resource.id, value);
      }

      return;
    }

    setValueError("");
    updateValueInLocalSurvey(resource.id, value);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        setUserSegment={setUserSegment}
        userSegment={userSegment}
      />

      <Select
        value={attributeClass}
        onValueChange={(value) => {
          updateAttributeClassIdInLocalSurvey(resource.id, value);
        }}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap capitalize"
          hideArrow>
          <SelectValue />
          <div className="flex items-center gap-1">
            <TagIcon className="h-4 w-4 text-sm" />
            <p>{attributeClass}</p>
          </div>
        </SelectTrigger>

        <SelectContent>
          {attributeClasses
            ?.filter((attributeClass) => !attributeClass.archived)
            ?.map((attributeClass) => (
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
            <SelectItem value={operator.id} title={convertOperatorToTitle(operator.id)}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {resource.qualifier.operator !== "isSet" && (
        <div className="relative flex flex-col gap-1">
          <Input
            value={resource.value}
            onChange={checkValueAndUpdate}
            className={cn("w-auto", valueError && "border border-red-500 focus:border-red-500")}
          />

          {valueError && (
            <p className="absolute -bottom-1.5 right-1 bg-white text-xs text-red-500">{valueError}</p>
          )}
        </div>
      )}

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    </div>
  );
};

type TActionSegmentFilterProps = SegmentFilterItemProps & {
  onAddFilterBelow: () => void;
  resource: TUserSegmentActionFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TUserSegmentFilterValue) => void;
};
const ActionSegmentFilter = ({
  environmentId,
  connector,
  resource,
  userSegment,
  setUserSegment,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
}: TActionSegmentFilterProps) => {
  const { actionClassId } = resource.root;
  const { eventClasses, isLoadingEventClasses } = useEventClasses(environmentId);
  const operatorText = convertOperatorToText(resource.qualifier.operator);
  const qualifierMetric = resource.qualifier.metric;

  const [valueError, setValueError] = useState("");

  if (isLoadingEventClasses) {
    return (
      <div className="h-10 w-10">
        <LoadingSpinner />
      </div>
    );
  }

  const operatorArr = BASE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator),
  }));

  const actionMetrics = ACTION_METRICS.map((metric) => ({
    id: metric,
    name: convertMetricToText(metric),
  }));

  const actionClass = eventClasses.find((eventClass) => eventClass.id === actionClassId)?.name;

  const updateOperatorInUserSegment = (filterId: string, newOperator: TBaseOperator) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const updateActionClassIdInUserSegment = (filterId: string, actionClassId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const updateActionMetricInLocalSurvey = (filterId: string, newMetric: TActionMetric) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const checkValueAndUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    updateValueInLocalSurvey(resource.id, value);

    if (!value) {
      setValueError("Value cannot be empty");
      return;
    }

    const isNumber = z.coerce.number().safeParse(value);

    if (isNumber.success) {
      setValueError("");
      updateValueInLocalSurvey(resource.id, parseInt(value, 10));
    } else {
      setValueError("Value must be a number");
      updateValueInLocalSurvey(resource.id, value);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
      />

      <Select
        value={actionClass}
        onValueChange={(value) => {
          updateActionClassIdInUserSegment(resource.id, value);
        }}>
        <SelectTrigger className="w-auto items-center justify-center whitespace-nowrap capitalize" hideArrow>
          <SelectValue />
          <div className="flex items-center gap-1">
            <MousePointerClick className="h-4 w-4 text-sm" />
            <p>{actionClass}</p>
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
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap capitalize"
          hideArrow>
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
          updateOperatorInUserSegment(resource.id, operator);
        }}>
        <SelectTrigger className="flex w-full max-w-[40px] items-center justify-center text-center" hideArrow>
          <SelectValue />
          <p>{operatorText}</p>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id} title={convertOperatorToTitle(operator.id)}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex flex-col gap-1">
        <Input
          value={resource.value}
          onChange={checkValueAndUpdate}
          className={cn("w-auto", valueError && "border border-red-500 focus:border-red-500")}
        />

        {valueError && (
          <p className="absolute -bottom-1.5 right-1 bg-white text-xs text-red-500">{valueError}</p>
        )}
      </div>

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    </div>
  );
};

type TUserSegmentFilterProps = SegmentFilterItemProps & {
  onAddFilterBelow: () => void;
  resource: TUserSegmentSegmentFilter;
};
const UserSegmentFilter = ({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  userSegment,
  userSegments,
  setUserSegment,
}: TUserSegmentFilterProps) => {
  const { userSegmentId } = resource.root;
  const operatorText = convertOperatorToText(resource.qualifier.operator);

  const currentUserSegment = userSegments?.find((segment) => segment.id === userSegmentId);

  const updateOperatorInUserSegment = (filterId: string, newOperator: TSegmentOperator) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const updateSegmentIdInUserSegment = (filterId: string, newSegmentId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              (resource as TUserSegmentSegmentFilter).root.userSegmentId = newSegmentId;
              resource.value = newSegmentId;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const toggleSegmentOperator = () => {
    if (!resource.qualifier.operator) return;

    if (resource.qualifier.operator === "userIsIn") {
      updateOperatorInUserSegment(resource.id, "userIsNotIn");
      return;
    }

    updateOperatorInUserSegment(resource.id, "userIsIn");
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
      />

      <div>
        <span
          className="cursor-pointer underline"
          onClick={() => {
            toggleSegmentOperator();
          }}>
          {operatorText}
        </span>
      </div>

      <Select
        value={currentUserSegment?.id}
        onValueChange={(value) => {
          updateSegmentIdInUserSegment(resource.id, value);
        }}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap capitalize"
          hideArrow>
          <div className="flex items-center gap-1">
            <Users2Icon className="h-4 w-4 text-sm" />
            <SelectValue />
          </div>
        </SelectTrigger>

        <SelectContent>
          {userSegments
            ?.filter((segment) => !segment.isPrivate)
            .map((segment) => <SelectItem value={segment.id}>{segment.title}</SelectItem>)}
        </SelectContent>
      </Select>

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    </div>
  );
};

type TDeviceFilterProps = SegmentFilterItemProps & {
  onAddFilterBelow: () => void;
  resource: TUserSegmentDeviceFilter;
};
const DeviceFilter = ({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  userSegment,
  setUserSegment,
}: TDeviceFilterProps) => {
  const { value } = resource;

  const operatorText = convertOperatorToText(resource.qualifier.operator);
  const operatorArr = DEVICE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator),
  }));

  const updateOperatorInUserSegment = (filterId: string, newOperator: TDeviceOperator) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const updateValueInUserSegment = (filterId: string, newValue: "phone" | "desktop") => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === filterId) {
              (resource as TUserSegmentDeviceFilter).root.deviceType = newValue;
              resource.value = newValue;
              break;
            }
          } else {
            searchAndUpdate(resource);
          }
        }
      };

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        key={connector}
        connector={connector}
        filterId={resource.id}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
      />

      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
        <MonitorSmartphoneIcon className="h-4 w-4" />
        <p>Device</p>
      </div>

      <Select
        value={operatorText}
        onValueChange={(operator: TDeviceOperator) => {
          updateOperatorInUserSegment(resource.id, operator);
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

      <Select
        value={value as "phone" | "desktop"}
        onValueChange={(value: "phone" | "desktop") => {
          updateValueInUserSegment(resource.id, value);
        }}>
        <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {[
            { id: "desktop", name: "Desktop" },
            { id: "phone", name: "Phone" },
          ].map((operator) => (
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    </div>
  );
};

const SegmentFilterItem = ({
  resource,
  connector,
  environmentId,
  userSegment,
  userSegments,
  actionClasses,
  attributeClasses,
  setUserSegment,
  handleAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
}: SegmentFilterItemProps) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const updateFilterValueInUserSegment = (filterId: string, newValue: string | number) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const onAddFilterBelow = () => {
    setAddFilterModalOpen(true);
  };

  const RenderFilterModal = () => (
    <AddFilterModal
      open={addFilterModalOpen}
      setOpen={setAddFilterModalOpen}
      onAddFilter={(filter) => handleAddFilterBelow(resource.id, filter)}
      actionClasses={actionClasses}
      attributeClasses={attributeClasses}
      userSegments={userSegments}
    />
  );

  switch (resource.root.type) {
    case "action":
      return (
        <>
          <ActionSegmentFilter
            connector={connector}
            resource={resource as TUserSegmentActionFilter}
            environmentId={environmentId}
            userSegment={userSegment}
            userSegments={userSegments}
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            setUserSegment={setUserSegment}
            onAddFilterBelow={onAddFilterBelow}
            handleAddFilterBelow={handleAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            updateValueInLocalSurvey={updateFilterValueInUserSegment}
          />

          <RenderFilterModal />
        </>
      );

    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            connector={connector}
            resource={resource as TUserSegmentAttributeFilter}
            environmentId={environmentId}
            userSegment={userSegment}
            userSegments={userSegments}
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            setUserSegment={setUserSegment}
            onAddFilterBelow={onAddFilterBelow}
            handleAddFilterBelow={handleAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            updateValueInLocalSurvey={updateFilterValueInUserSegment}
          />

          <RenderFilterModal />
        </>
      );

    case "segment":
      return (
        <>
          <UserSegmentFilter
            connector={connector}
            resource={resource as TUserSegmentSegmentFilter}
            environmentId={environmentId}
            userSegment={userSegment}
            userSegments={userSegments}
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            setUserSegment={setUserSegment}
            onAddFilterBelow={onAddFilterBelow}
            handleAddFilterBelow={handleAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
          />

          <RenderFilterModal />
        </>
      );

    case "device":
      return (
        <>
          <DeviceFilter
            connector={connector}
            resource={resource as TUserSegmentDeviceFilter}
            environmentId={environmentId}
            userSegment={userSegment}
            userSegments={userSegments}
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            setUserSegment={setUserSegment}
            onAddFilterBelow={onAddFilterBelow}
            handleAddFilterBelow={handleAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
          />

          <RenderFilterModal />
        </>
      );

    default:
      return <div>Unknown filter type</div>;
  }
};

export default SegmentFilterItem;
