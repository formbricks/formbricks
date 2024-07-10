import {
  FingerprintIcon,
  MonitorSmartphoneIcon,
  MoreVertical,
  MousePointerClick,
  TagIcon,
  Trash2,
  Users2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@formbricks/lib/cn";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import {
  convertMetricToText,
  convertOperatorToText,
  convertOperatorToTitle,
  toggleFilterConnector,
  updateActionClassIdInFilter,
  updateAttributeClassNameInFilter,
  updateDeviceTypeInFilter,
  updateFilterValue,
  updateMetricInFilter,
  updateOperatorInFilter,
  updatePersonIdentifierInFilter,
  updateSegmentIdInFilter,
} from "@formbricks/lib/segment/utils";
import { isCapitalized } from "@formbricks/lib/utils/strings";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type {
  TActionMetric,
  TArithmeticOperator,
  TAttributeOperator,
  TBaseFilter,
  TBaseOperator,
  TDeviceOperator,
  TSegment,
  TSegmentActionFilter,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentFilterValue,
  TSegmentOperator,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";
import {
  ACTION_METRICS,
  ARITHMETIC_OPERATORS,
  ATTRIBUTE_OPERATORS,
  BASE_OPERATORS,
  DEVICE_OPERATORS,
  PERSON_OPERATORS,
} from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Input } from "@formbricks/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { AddFilterModal } from "./add-filter-modal";

interface TSegmentFilterProps {
  connector: TSegmentConnector;
  resource: TSegmentFilter;
  environmentId: string;
  segment: TSegment;
  segments: TSegment[];
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  setSegment: (segment: TSegment) => void;
  handleAddFilterBelow: (resourceId: string, filter: TBaseFilter) => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
}

function SegmentFilterItemConnector({
  connector,
  segment,
  setSegment,
  filterId,
  viewOnly,
}: {
  connector: TSegmentConnector;
  segment: TSegment;
  setSegment: (segment: TSegment) => void;
  filterId: string;
  viewOnly?: boolean;
}) {
  const updateLocalSurvey = (newConnector: TSegmentConnector) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      toggleFilterConnector(updatedSegment.filters, filterId, newConnector);
    }

    setSegment(updatedSegment);
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
      <span
        className={cn(Boolean(connector) && "cursor-pointer underline", viewOnly && "cursor-not-allowed")}
        onClick={() => {
          if (viewOnly) return;
          onConnectorChange();
        }}>
        {connector ? connector : "Where"}
      </span>
    </div>
  );
}

function SegmentFilterItemContextMenu({
  filterId,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  viewOnly,
}: {
  filterId: string;
  onAddFilterBelow: () => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger disabled={viewOnly}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => {
              onAddFilterBelow();
            }}>
            Add filter below
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              onCreateGroup(filterId);
            }}>
            Create group
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "up");
            }}>
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "down");
            }}>
            Move down
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        className="mr-4 p-0"
        disabled={viewOnly}
        onClick={() => {
          if (viewOnly) return;
          onDeleteFilter(filterId);
        }}
        variant="minimal">
        <Trash2 className={cn("h-4 w-4 cursor-pointer", viewOnly && "cursor-not-allowed")} />
      </Button>
    </div>
  );
}

type TAttributeSegmentFilterProps = TSegmentFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentAttributeFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
};

function AttributeSegmentFilter({
  connector,
  resource,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  segment,
  setSegment,
  attributeClasses,
  viewOnly,
}: TAttributeSegmentFilterProps) {
  const { attributeClassName } = resource.root;
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

  const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const attributeClass = attributeClasses.find((attrClass) => attrClass.name === attributeClassName)?.name;

  const updateOperatorInLocalSurvey = (filterId: string, newOperator: TAttributeOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, filterId, newOperator);
    }

    setSegment(updatedSegment);
  };

  const updateAttributeClassNameInLocalSurvey = (filterId: string, newAttributeClassName: string) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateAttributeClassNameInFilter(updatedSegment.filters, filterId, newAttributeClassName);
    }

    setSegment(updatedSegment);
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
        connector={connector}
        filterId={resource.id}
        key={connector}
        segment={segment}
        setSegment={setSegment}
        viewOnly={viewOnly}
      />

      <Select
        disabled={viewOnly}
        onValueChange={(value) => {
          updateAttributeClassNameInLocalSurvey(resource.id, value);
        }}
        value={attributeClass}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue>
            <div
              className={cn("flex items-center gap-2", !isCapitalized(attributeClass ?? "") && "lowercase")}>
              <TagIcon className="h-4 w-4 text-sm" />
              <p>{attributeClass}</p>
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {attributeClasses
            .filter((attributeClass) => !attributeClass.archived)
            .map((attrClass) => (
              <SelectItem key={attrClass.id} value={attrClass.name}>
                {attrClass.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        disabled={viewOnly}
        onValueChange={(operator: TAttributeOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}
        value={operatorText}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem title={convertOperatorToTitle(operator.id)} value={operator.id}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
            className={cn("w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
            disabled={viewOnly}
            onChange={(e) => {
              if (viewOnly) return;
              checkValueAndUpdate(e);
            }}
            value={resource.value}
          />

          {valueError ? (
            <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">
              {valueError}
            </p>
          ) : null}
        </div>
      )}

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
}

type TPersonSegmentFilterProps = TSegmentFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentPersonFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
};

function PersonSegmentFilter({
  connector,
  resource,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  segment,
  setSegment,
  viewOnly,
}: TPersonSegmentFilterProps) {
  const { personIdentifier } = resource.root;
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

  const operatorArr = PERSON_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const updateOperatorInLocalSurvey = (filterId: string, newOperator: TAttributeOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, filterId, newOperator);
    }

    setSegment(updatedSegment);
  };

  const updatePersonIdentifierInLocalSurvey = (filterId: string, newPersonIdentifier: string) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updatePersonIdentifierInFilter(updatedSegment.filters, filterId, newPersonIdentifier);
    }

    setSegment(updatedSegment);
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
        connector={connector}
        filterId={resource.id}
        key={connector}
        segment={segment}
        setSegment={setSegment}
        viewOnly={viewOnly}
      />

      <Select
        disabled={viewOnly}
        onValueChange={(value) => {
          updatePersonIdentifierInLocalSurvey(resource.id, value);
        }}
        value={personIdentifier}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue>
            <div className="flex items-center gap-1 lowercase">
              <FingerprintIcon className="h-4 w-4 text-sm" />
              <p>{personIdentifier}</p>
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          <SelectItem key={personIdentifier} value={personIdentifier}>
            {personIdentifier}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        disabled={viewOnly}
        onValueChange={(operator: TAttributeOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}
        value={operatorText}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem title={convertOperatorToTitle(operator.id)} value={operator.id}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
            className={cn("w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
            disabled={viewOnly}
            onChange={(e) => {
              if (viewOnly) return;
              checkValueAndUpdate(e);
            }}
            value={resource.value}
          />

          {valueError ? (
            <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">
              {valueError}
            </p>
          ) : null}
        </div>
      )}

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
}

type TActionSegmentFilterProps = TSegmentFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentActionFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
};
function ActionSegmentFilter({
  connector,
  resource,
  segment,
  setSegment,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  actionClasses,
  viewOnly,
}: TActionSegmentFilterProps) {
  const { actionClassId } = resource.root;
  const operatorText = convertOperatorToText(resource.qualifier.operator);
  const qualifierMetric = resource.qualifier.metric;

  const [valueError, setValueError] = useState("");

  const operatorArr = BASE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator),
  }));

  const actionMetrics = ACTION_METRICS.map((metric) => ({
    id: metric,
    name: convertMetricToText(metric),
  }));

  const actionClass = actionClasses.find((actionClass) => actionClass.id === actionClassId)?.name;

  const updateOperatorInSegment = (filterId: string, newOperator: TBaseOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, filterId, newOperator);
    }

    setSegment(updatedSegment);
  };

  const updateActionClassIdInSegment = (filterId: string, actionClassId: string) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateActionClassIdInFilter(updatedSegment.filters, filterId, actionClassId);
    }

    setSegment(updatedSegment);
  };

  const updateActionMetricInLocalSurvey = (filterId: string, newMetric: TActionMetric) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateMetricInFilter(updatedSegment.filters, filterId, newMetric);
    }

    setSegment(updatedSegment);
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
        connector={connector}
        filterId={resource.id}
        key={connector}
        segment={segment}
        setSegment={setSegment}
        viewOnly={viewOnly}
      />

      <Select
        disabled={viewOnly}
        onValueChange={(value) => {
          updateActionClassIdInSegment(resource.id, value);
        }}
        value={actionClass}>
        <SelectTrigger
          className="w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue>
            <div className="flex items-center gap-1">
              <MousePointerClick className="h-4 w-4 text-sm" />
              <p>{actionClass}</p>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bottom-0">
          {actionClasses.map((actionClass) => (
            <SelectItem value={actionClass.id}>{actionClass.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        disabled={viewOnly}
        onValueChange={(value: TActionMetric) => {
          updateActionMetricInLocalSurvey(resource.id, value);
        }}
        value={qualifierMetric}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
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
        disabled={viewOnly}
        onValueChange={(operator: TBaseOperator) => {
          updateOperatorInSegment(resource.id, operator);
        }}
        value={operatorText}>
        <SelectTrigger
          className="flex w-full max-w-[40px] items-center justify-center bg-white text-center"
          hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem title={convertOperatorToTitle(operator.id)} value={operator.id}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex flex-col gap-1">
        <Input
          className={cn("w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
          disabled={viewOnly}
          onChange={(e) => {
            if (viewOnly) return;
            checkValueAndUpdate(e);
          }}
          value={resource.value}
        />

        {valueError ? (
          <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">{valueError}</p>
        ) : null}
      </div>

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
}

type TSegmentSegmentFilterProps = TSegmentFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentSegmentFilter;
};
function SegmentSegmentFilter({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  segment,
  segments,
  setSegment,
  viewOnly,
}: TSegmentSegmentFilterProps) {
  const { segmentId } = resource.root;
  const operatorText = convertOperatorToText(resource.qualifier.operator);

  const currentSegment = segments.find((segment) => segment.id === segmentId);

  const updateOperatorInSegment = (filterId: string, newOperator: TSegmentOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, filterId, newOperator);
    }

    setSegment(updatedSegment);
  };

  const updateSegmentIdInSegment = (filterId: string, newSegmentId: string) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateSegmentIdInFilter(updatedSegment.filters, filterId, newSegmentId);
    }

    setSegment(updatedSegment);
  };

  const toggleSegmentOperator = () => {
    if (!resource.qualifier.operator) return;

    if (resource.qualifier.operator === "userIsIn") {
      updateOperatorInSegment(resource.id, "userIsNotIn");
      return;
    }

    updateOperatorInSegment(resource.id, "userIsIn");
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        connector={connector}
        filterId={resource.id}
        key={connector}
        segment={segment}
        setSegment={setSegment}
        viewOnly={viewOnly}
      />

      <div>
        <span
          className={cn("cursor-pointer underline", viewOnly && "cursor-not-allowed")}
          onClick={() => {
            if (viewOnly) return;
            toggleSegmentOperator();
          }}>
          {operatorText}
        </span>
      </div>

      <Select
        disabled={viewOnly}
        onValueChange={(value) => {
          updateSegmentIdInSegment(resource.id, value);
        }}
        value={currentSegment?.id}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <div className="flex items-center gap-1">
            <Users2Icon className="h-4 w-4 text-sm" />
            <SelectValue />
          </div>
        </SelectTrigger>

        <SelectContent>
          {segments
            .filter((segment) => !segment.isPrivate)
            .map((segment) => (
              <SelectItem value={segment.id}>{segment.title}</SelectItem>
            ))}
        </SelectContent>
      </Select>

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onAddFilterBelow={onAddFilterBelow}
        onCreateGroup={onCreateGroup}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
}

type TDeviceFilterProps = TSegmentFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentDeviceFilter;
};
function DeviceFilter({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  segment,
  setSegment,
  viewOnly,
}: TDeviceFilterProps) {
  const { value } = resource;

  const operatorText = convertOperatorToText(resource.qualifier.operator);
  const operatorArr = DEVICE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator),
  }));

  const updateOperatorInSegment = (filterId: string, newOperator: TDeviceOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, filterId, newOperator);
    }

    setSegment(updatedSegment);
  };

  const updateValueInSegment = (filterId: string, newValue: "phone" | "desktop") => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateDeviceTypeInFilter(updatedSegment.filters, filterId, newValue);
    }

    setSegment(updatedSegment);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <SegmentFilterItemConnector
        connector={connector}
        filterId={resource.id}
        key={connector}
        segment={segment}
        setSegment={setSegment}
        viewOnly={viewOnly}
      />

      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
        <MonitorSmartphoneIcon className="h-4 w-4" />
        <p>Device</p>
      </div>

      <Select
        disabled={viewOnly}
        onValueChange={(operator: TDeviceOperator) => {
          updateOperatorInSegment(resource.id, operator);
        }}
        value={operatorText}>
        <SelectTrigger
          className="flex w-auto max-w-[40px] items-center justify-center bg-white text-center"
          hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id}>{operator.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        disabled={viewOnly}
        onValueChange={(value: "phone" | "desktop") => {
          updateValueInSegment(resource.id, value);
        }}
        value={value as "phone" | "desktop"}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
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
        viewOnly={viewOnly}
      />
    </div>
  );
}

export function SegmentFilter({
  resource,
  connector,
  environmentId,
  segment,
  segments,
  actionClasses,
  attributeClasses,
  setSegment,
  handleAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  viewOnly = false,
}: TSegmentFilterProps) {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const updateFilterValueInSegment = (filterId: string, newValue: string | number) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateFilterValue(updatedSegment.filters, filterId, newValue);
    }

    setSegment(updatedSegment);
  };

  const onAddFilterBelow = () => {
    setAddFilterModalOpen(true);
  };

  function RenderFilterModal() {
    return (
      <AddFilterModal
        actionClasses={actionClasses}
        attributeClasses={attributeClasses}
        onAddFilter={(filter) => {
          handleAddFilterBelow(resource.id, filter);
        }}
        open={addFilterModalOpen}
        segments={segments}
        setOpen={setAddFilterModalOpen}
      />
    );
  }

  switch (resource.root.type) {
    case "action":
      return (
        <>
          <ActionSegmentFilter
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            connector={connector}
            environmentId={environmentId}
            handleAddFilterBelow={handleAddFilterBelow}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentActionFilter}
            segment={segment}
            segments={segments}
            setSegment={setSegment}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />

          <RenderFilterModal />
        </>
      );

    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            connector={connector}
            environmentId={environmentId}
            handleAddFilterBelow={handleAddFilterBelow}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentAttributeFilter}
            segment={segment}
            segments={segments}
            setSegment={setSegment}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />

          <RenderFilterModal />
        </>
      );

    case "person":
      return (
        <>
          <PersonSegmentFilter
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            connector={connector}
            environmentId={environmentId}
            handleAddFilterBelow={handleAddFilterBelow}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentPersonFilter}
            segment={segment}
            segments={segments}
            setSegment={setSegment}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />

          <RenderFilterModal />
        </>
      );

    case "segment":
      return (
        <>
          <SegmentSegmentFilter
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            connector={connector}
            environmentId={environmentId}
            handleAddFilterBelow={handleAddFilterBelow}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentSegmentFilter}
            segment={segment}
            segments={segments}
            setSegment={setSegment}
            viewOnly={viewOnly}
          />

          <RenderFilterModal />
        </>
      );

    case "device":
      return (
        <>
          <DeviceFilter
            actionClasses={actionClasses}
            attributeClasses={attributeClasses}
            connector={connector}
            environmentId={environmentId}
            handleAddFilterBelow={handleAddFilterBelow}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentDeviceFilter}
            segment={segment}
            segments={segments}
            setSegment={setSegment}
            viewOnly={viewOnly}
          />

          <RenderFilterModal />
        </>
      );

    default:
      return <div>Unknown filter type</div>;
  }
}
