import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { cn } from "@formbricks/lib/cn";
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
  TUserSegmentSegmentFilter,
  TSegmentOperator,
  TUserSegment,
  isResourceFilter,
  TUserSegmentDeviceFilter,
  TDeviceOperator,
  DEVICE_OPERATORS,
  ARITHMETIC_OPERATORS,
  STRING_OPERATORS,
  TArithmeticOperator,
  TStringOperator,
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
import { useUserSegments } from "@/lib/userSegments/userSegments";
import z from "zod";

type SegmentFilterItemProps = {
  connector: TUserSegmentConnector;
  resource: TUserSegmentFilter;
  environmentId: string;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
  onAddFilterBelow: (filterId: string) => void;
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

type TAttributeSegmentFilterProps = SegmentFilterItemProps & {
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

  const [valueInput, setValueInput] = useState(resource.value);
  const [valueError, setValueError] = useState("");

  if (isLoadingAttributeClasses) {
    return <div>Loading...</div>;
  }

  const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const attributeClass = attributeClasses?.find(
    (attributeClass) => attributeClass?.id === attributeClassId
  )?.name;

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

  const checkValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setValueInput(value);

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

    if (STRING_OPERATORS.includes(operator as TStringOperator)) {
      const isString = z.coerce.string().safeParse(value);

      if (isString.success) {
        setValueError("");
        updateValueInLocalSurvey(resource.id, value);
      } else {
        setValueError("Value must be a string");
        updateValueInLocalSurvey(resource.id, value);
      }

      return;
    }
  };

  return (
    <div className="flex items-center gap-4 text-sm">
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
        <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
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
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex flex-col gap-1">
        <Input
          value={valueInput}
          onChange={(e) => {
            checkValue(e);
          }}
          className={cn("w-auto", valueError && "border border-red-500 focus:border-red-500")}
        />

        {valueError && (
          <p className="absolute -bottom-1.5 right-1 bg-white text-xs text-red-500">{valueError}</p>
        )}
      </div>

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

  const [valueInput, setValueInput] = useState(resource.value);
  const [valueError, setValueError] = useState("");

  if (isLoadingEventClasses) {
    return <div>Loading...</div>;
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

  const checkValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setValueInput(value);

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
    <div className="flex items-center gap-4 text-sm">
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
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex flex-col gap-1">
        <Input
          value={valueInput}
          onChange={(e) => {
            checkValue(e);
          }}
          className={cn("w-auto", valueError && "border border-red-500 focus:border-red-500")}
        />

        {valueError && (
          <p className="absolute -bottom-1.5 right-1 bg-white text-xs text-red-500">{valueError}</p>
        )}
      </div>

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

type TUserSegmentFilterProps = SegmentFilterItemProps & {
  resource: TUserSegmentSegmentFilter;
};
const UserSegmentFilter = ({
  connector,
  environmentId,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  userSegment,
  setUserSegment,
}: TUserSegmentFilterProps) => {
  const { userSegmentId } = resource.root;
  const { userSegments, isLoadingUserSegments } = useUserSegments(environmentId);
  const operatorText = convertOperatorToText(resource.qualifier.operator);

  if (isLoadingUserSegments) {
    return <div>Loading...</div>;
  }

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
    <div className="flex items-center gap-4 text-sm">
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
        <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
          <div className="flex items-center gap-1">
            <TagIcon className="h-4 w-4 text-sm" />
            <SelectValue />
          </div>
        </SelectTrigger>

        <SelectContent>
          {userSegments
            ?.filter((segment) => !segment.isPrivate)
            .map((segment) => (
              <SelectItem value={segment.id}>{segment.title}</SelectItem>
            ))}
        </SelectContent>
      </Select>

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

type TDeviceFilterProps = SegmentFilterItemProps & {
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
    <div className="flex items-center gap-4 text-sm">
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

type TAddNewFilterItemProps = {
  connector: TUserSegmentConnector;
  filterId: string;
  environmentId: string;
  onDeleteFilter: (filterId: string) => void;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
};
const AddNewFilterItem = ({
  connector,
  filterId,
  environmentId,
  onDeleteFilter,
  userSegment,
  setUserSegment,
}: TAddNewFilterItemProps) => {
  const [activeTabId, setActiveId] = useState("actions");
  const { attributeClasses } = useAttributeClasses(environmentId);
  const { eventClasses } = useEventClasses(environmentId);
  const { userSegments } = useUserSegments(environmentId);

  const tabs = [
    { id: "actions", label: "Actions" },
    { id: "attributes", label: "Attributes" },
    { id: "segments", label: "Segments" },
    { id: "devices", label: "Devices" },
  ];

  const devices = [
    { id: "phone", name: "Phone" },
    { id: "desktop", name: "Desktop" },
  ];

  const onAddFilter = (filter: TUserSegmentFilter) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <SegmentFilterItemConnector
        connector={connector}
        filterId={filterId}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
      />
      <Popover>
        <PopoverTrigger>
          <div className="rounded-md bg-slate-200 p-2 text-slate-600 hover:border hover:border-slate-500">
            <span>Select filter...</span>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-full max-w-lg bg-slate-50">
          <div className="flex flex-col">
            <TabBar activeId={activeTabId} setActiveId={setActiveId} tabs={tabs} />

            <div className="max-h-96 overflow-auto">
              {activeTabId === "actions" && (
                <div className="flex flex-col">
                  {eventClasses.map((eventClass) => (
                    <div
                      className="flex cursor-pointer items-center gap-2 p-1"
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
                <div className="flex flex-col">
                  {attributeClasses.map((attributeClass) => (
                    <div
                      className="flex cursor-pointer items-center gap-2 p-1"
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

              {activeTabId === "segments" && !!userSegments && (
                <div className="flex flex-col">
                  {userSegments
                    .filter((segment) => !segment.isPrivate)
                    .map((segment) => (
                      <div
                        className="flex cursor-pointer items-center gap-2 p-1"
                        onClick={() => {
                          const filter: TUserSegmentFilter = {
                            id: "sample",
                            root: {
                              type: "segment",
                              userSegmentId: segment.id,
                            },
                            qualifier: {
                              operator: "userIsIn",
                            },
                            value: segment.id,
                          };

                          onAddFilter(filter);
                        }}>
                        <Users2Icon className="h-4 w-4" />
                        <span>{segment.title}</span>
                      </div>
                    ))}
                </div>
              )}

              {activeTabId === "devices" && (
                <div className="flex flex-col">
                  {devices.map((deviceType) => (
                    <div
                      key={deviceType.id}
                      className="flex cursor-pointer items-center gap-2 p-1"
                      onClick={() => {
                        const filter: TUserSegmentFilter = {
                          id: "sample",
                          root: {
                            type: "device",
                            deviceType: deviceType.id,
                          },
                          qualifier: {
                            operator: "equals",
                          },
                          value: deviceType.id,
                        };

                        onAddFilter(filter);
                      }}>
                      <MonitorSmartphoneIcon className="h-4 w-4" />
                      <span>{deviceType.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <button onClick={() => onDeleteFilter(filterId)}>
          <Trash2 className="h-4 w-4 cursor-pointer"></Trash2>
        </button>
      </div>
    </div>
  );
};

const SegmentFilterItem = ({
  resource,
  connector,
  environmentId,
  userSegment,
  setUserSegment,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
}: SegmentFilterItemProps) => {
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

  // placeholder UI

  if ((resource as TUserSegmentFilter).isPlaceholder) {
    return (
      <AddNewFilterItem
        environmentId={environmentId}
        connector={connector}
        filterId={resource.id}
        onDeleteFilter={onDeleteFilter}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
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
        userSegment={userSegment}
        setUserSegment={setUserSegment}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        updateValueInLocalSurvey={updateFilterValueInUserSegment}
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
        userSegment={userSegment}
        setUserSegment={setUserSegment}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        updateValueInLocalSurvey={updateFilterValueInUserSegment}
      />
    );
  }

  // segment UI

  if (resource.root.type === "segment") {
    return (
      <UserSegmentFilter
        connector={connector}
        resource={resource as TUserSegmentSegmentFilter}
        environmentId={environmentId}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    );
  }

  // device UI

  if (resource.root.type === "device") {
    return (
      <DeviceFilter
        connector={connector}
        resource={resource as TUserSegmentDeviceFilter}
        environmentId={environmentId}
        userSegment={userSegment}
        setUserSegment={setUserSegment}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
      />
    );
  }
};

const SegmentFilters = ({
  group,
  environmentId,
  setUserSegment,
  userSegment,
}: {
  group: TBaseFilterGroup;
  environmentId: string;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
}) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);

  const handleAddFilterBelow = (resourceId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleCreateGroup = (resourceId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndCreateGroup(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleMoveResource = (resourceId: string, direction: "up" | "down") => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndMove(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleDeleteResource = (resourceId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        deleteResource(draft.filters);

        // check if there are any empty groups and delete them
        deleteEmptyGroups(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const toggleGroupConnector = (groupId: string, newConnectorValue: TUserSegmentConnector) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
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
    const updatedUserSegment = produce(userSegment, (draft) => {
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

      if (draft.filters) {
        addFilter(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-white">
      {group?.map((groupItem) => {
        const { connector, resource, id: groupId } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <SegmentFilterItem
              key={groupId}
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              userSegment={userSegment}
              setUserSegment={setUserSegment}
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
            <div key={groupId}>
              <div className="flex items-start gap-2">
                <div key={connector} className="w-auto">
                  <span
                    className={cn(!!connector && "cursor-pointer underline")}
                    onClick={() => onConnectorChange(groupId, connector)}>
                    {!!connector ? connector : "Where"}
                  </span>
                </div>

                <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
                  <SegmentFilters
                    group={resource}
                    environmentId={environmentId}
                    userSegment={userSegment}
                    setUserSegment={setUserSegment}
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
