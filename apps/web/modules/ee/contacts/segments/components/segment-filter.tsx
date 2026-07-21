"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  FingerprintIcon,
  MonitorSmartphoneIcon,
  MoreVertical,
  Trash2,
  Users2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  ARITHMETIC_OPERATORS,
  DATE_OPERATORS,
  DEVICE_OPERATORS,
  NUMBER_TYPE_OPERATORS,
  PERSON_OPERATORS,
  STRING_TYPE_OPERATORS,
  SURVEY_INTERACTION_OPERATORS,
  SURVEY_INTERACTION_TIME_UNITS,
  type TArithmeticOperator,
  type TAttributeOperator,
  type TBaseFilter,
  type TDeviceOperator,
  type TSegment,
  type TSegmentAttributeFilter,
  type TSegmentConnector,
  type TSegmentDeviceFilter,
  type TSegmentFilter,
  type TSegmentFilterValue,
  type TSegmentOperator,
  type TSegmentPersonFilter,
  type TSegmentSegmentFilter,
  type TSegmentSurveyInteractionFilter,
  type TSegmentSurveyInteractionFilterValue,
  type TSurveyInteractionOperator,
  type TSurveyInteractionTimeUnit,
  isDateOperator,
} from "@formbricks/types/segment";
import { cn } from "@/lib/cn";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import {
  convertOperatorToText,
  convertOperatorToTitle,
  toggleFilterConnector,
  updateContactAttributeKeyInFilter,
  updateDeviceTypeInFilter,
  updateFilterValue,
  updateOperatorInFilter,
  updatePersonIdentifierInFilter,
  updateSegmentIdInFilter,
  updateSurveyInteractionValueInFilter,
} from "@/modules/ee/contacts/segments/lib/utils";
import { getContactAttributeDataTypeIcon } from "@/modules/ee/contacts/utils";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { getSurveysForSegmentFilterAction } from "../actions";
import { AddFilterModal } from "./add-filter-modal";
import { AttributeValueInput } from "./attribute-value-input";
import { DateFilterValue } from "./date-filter-value";

// Props shared by every leaf filter component. The dispatcher-only props (workspace segments, attribute
// keys, add-filter callback) live on TSegmentFilterProps so individual leaves don't declare props they
// never use.
interface TBaseFilterProps {
  connector: TSegmentConnector;
  resource: TSegmentFilter;
  segment: TSegment;
  setSegment: (segment: TSegment) => void;
  onCreateGroup: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
}

interface TSegmentFilterProps extends TBaseFilterProps {
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  handleAddFilterBelow: (resourceId: string, filter: TBaseFilter) => void;
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
  const { t } = useTranslation();
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
      <button
        type="button"
        aria-label={connector ?? t("workspace.segments.where")}
        className={cn(Boolean(connector) && "cursor-pointer underline", viewOnly && "cursor-not-allowed")}
        onClick={() => {
          if (viewOnly) return;
          onConnectorChange();
        }}>
        {connector ?? t("workspace.segments.where")}
      </button>
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
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={viewOnly}>
          <Button variant="outline" size="icon">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => {
              onAddFilterBelow();
            }}>
            {t("workspace.segments.add_filter_below")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              onCreateGroup(filterId);
            }}>
            {t("workspace.segments.create_group")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "up");
            }}
            icon={<ArrowUpIcon className="size-4" />}>
            {t("common.move_up")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "down");
            }}
            icon={<ArrowDownIcon className="size-4" />}>
            {t("common.move_down")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="icon"
        disabled={viewOnly}
        onClick={() => {
          if (viewOnly) return;
          onDeleteFilter(filterId);
        }}
        variant="outline">
        <Trash2 className={cn("h-4 w-4 cursor-pointer", viewOnly && "cursor-not-allowed")} />
      </Button>
    </div>
  );
}

type TAttributeSegmentFilterProps = TBaseFilterProps & {
  contactAttributeKeys: TContactAttributeKey[];
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
  contactAttributeKeys,
  viewOnly,
}: TAttributeSegmentFilterProps) {
  const { contactAttributeKey } = resource.root;
  const { t } = useTranslation();
  const operatorText = convertOperatorToText(resource.qualifier.operator, t);

  const [valueError, setValueError] = useState("");

  // when the operator changes, we need to check if the value is valid
  useEffect(() => {
    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(resource.value);

      if (isNumber.success) {
        setValueError("");
      } else {
        setValueError(t("workspace.segments.value_must_be_a_number"));
      }
    }
  }, [resource.qualifier, resource.value, t]);

  const attributeKey = contactAttributeKeys.find((attrKey) => attrKey.key === contactAttributeKey);
  const attrKeyValue = attributeKey?.name ?? attributeKey?.key ?? "";
  // Default to 'string' if dataType is undefined (for backwards compatibility)
  const attributeDataType = attributeKey?.dataType ?? "string";
  const isDateAttribute = attributeDataType === "date";

  // Show operators based on attribute data type
  const getOperatorsForDataType = () => {
    switch (attributeDataType) {
      case "date":
        return DATE_OPERATORS;
      case "number":
        return NUMBER_TYPE_OPERATORS;
      case "string":
      default:
        return STRING_TYPE_OPERATORS;
    }
  };
  const availableOperators = getOperatorsForDataType();
  const operatorArr = availableOperators.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator, t),
    };
  });

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
      updateContactAttributeKeyInFilter(updatedSegment.filters, filterId, newAttributeClassName);

      // When changing attribute, reset operator to appropriate default for the new attribute type
      const newAttributeKey = contactAttributeKeys.find((attrKey) => attrKey.key === newAttributeClassName);
      const newAttributeDataType = newAttributeKey?.dataType ?? "string";
      const defaultOperator = newAttributeDataType === "date" ? "isOlderThan" : "equals";
      const defaultValue = newAttributeDataType === "date" ? { amount: 1, unit: "days" as const } : "";

      updateOperatorInFilter(updatedSegment.filters, filterId, defaultOperator as any);
      updateFilterValue(updatedSegment.filters, filterId, defaultValue as any);
    }

    setSegment(updatedSegment);
  };

  const renderValueInput = () => {
    if (isDateAttribute && isDateOperator(resource.qualifier.operator)) {
      return (
        <DateFilterValue
          operator={resource.qualifier.operator}
          value={resource.value}
          onChange={(newValue) => {
            updateValueInLocalSurvey(resource.id, newValue);
          }}
          viewOnly={viewOnly}
        />
      );
    }

    if (attributeDataType === "string") {
      // Only show combobox if we have a valid attributeKeyId
      if (attributeKey?.id) {
        return (
          <AttributeValueInput
            attributeKeyId={attributeKey.id}
            value={resource.value as string}
            onChange={(newValue) => {
              updateValueInLocalSurvey(resource.id, newValue);
            }}
            disabled={viewOnly}
            valueError={valueError}
          />
        );
      }
    }

    return (
      <div className="relative flex flex-col gap-1">
        <Input
          className={cn("h-9 w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
          disabled={viewOnly}
          onChange={(e) => {
            if (viewOnly) return;
            const { value } = e.target;
            updateValueInLocalSurvey(resource.id, value);

            if (!value) {
              setValueError(t("workspace.segments.value_cannot_be_empty"));
              return;
            }

            const { operator } = resource.qualifier;

            if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
              const isNumber = z.coerce.number().safeParse(value);

              if (isNumber.success) {
                setValueError("");
                updateValueInLocalSurvey(resource.id, Number.parseInt(value, 10));
              } else {
                setValueError(t("workspace.segments.value_must_be_a_number"));
                updateValueInLocalSurvey(resource.id, value);
              }

              return;
            }

            setValueError("");
            updateValueInLocalSurvey(resource.id, value);
          }}
          value={resource.value as string | number}
        />

        {valueError ? (
          <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">{valueError}</p>
        ) : null}
      </div>
    );
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
        value={attrKeyValue}>
        <SelectTrigger
          className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
          hideArrow>
          <SelectValue>
            <div className="flex items-center gap-2">
              {getContactAttributeDataTypeIcon(attributeDataType)}
              <p>{attrKeyValue}</p>
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {contactAttributeKeys.map((attrClass) => (
            <SelectItem key={attrClass.id} value={attrClass.key}>
              <div className="flex items-center gap-2">
                {getContactAttributeDataTypeIcon(attrClass.dataType)}
                <span>{attrClass.name ?? attrClass.key}</span>
              </div>
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
            <SelectItem title={convertOperatorToTitle(operator.id, t)} value={operator.id} key={operator.id}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && renderValueInput()}

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

type TPersonSegmentFilterProps = TBaseFilterProps & {
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
  const { t } = useTranslation();
  const operatorText = convertOperatorToText(resource.qualifier.operator, t);
  const [valueError, setValueError] = useState("");

  // when the operator changes, we need to check if the value is valid
  useEffect(() => {
    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(resource.value);

      if (isNumber.success) {
        setValueError("");
      } else {
        setValueError(t("workspace.segments.value_must_be_a_number"));
      }
    }
  }, [resource.qualifier, resource.value, t]);

  const operatorArr = PERSON_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator, t),
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
      setValueError(t("workspace.segments.value_cannot_be_empty"));
      return;
    }

    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(value);

      if (isNumber.success) {
        setValueError("");
        updateValueInLocalSurvey(resource.id, parseInt(value, 10));
      } else {
        setValueError(t("workspace.segments.value_must_be_a_number"));
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
          className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
          hideArrow>
          <SelectValue>
            <div className="flex items-center gap-1 lowercase">
              <FingerprintIcon className="size-4 text-sm" />
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
            <SelectItem title={convertOperatorToTitle(operator.id, t)} value={operator.id} key={operator.id}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
            className={cn("h-8 w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
            disabled={viewOnly}
            onChange={(e) => {
              if (viewOnly) return;
              checkValueAndUpdate(e);
            }}
            value={resource.value as string | number}
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

type TSegmentSegmentFilterProps = TBaseFilterProps & {
  segments: TSegment[];
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
  const { t } = useTranslation();
  const operatorText = convertOperatorToText(resource.qualifier.operator, t);

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
        <button
          type="button"
          aria-label={operatorText}
          className={cn("cursor-pointer underline", viewOnly && "cursor-not-allowed")}
          onClick={() => {
            if (viewOnly) return;
            toggleSegmentOperator();
          }}>
          {operatorText}
        </button>
      </div>

      <Select
        disabled={viewOnly}
        onValueChange={(value) => {
          updateSegmentIdInSegment(resource.id, value);
        }}
        value={currentSegment?.id}>
        <SelectTrigger
          className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
          hideArrow>
          <div className="flex items-center gap-1">
            <Users2Icon className="size-4 text-sm" />
            <SelectValue />
          </div>
        </SelectTrigger>

        <SelectContent>
          {segments
            .filter((segment) => !segment.isPrivate)
            .map((segment) => (
              <SelectItem key={segment.id} value={segment.id}>
                {segment.title}
              </SelectItem>
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

type TDeviceFilterProps = TBaseFilterProps & {
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
  const { t } = useTranslation();
  const operatorText = convertOperatorToText(resource.qualifier.operator, t);
  const operatorArr = DEVICE_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator, t),
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
        <MonitorSmartphoneIcon className="size-4" />
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
            <SelectItem key={operator.id} value={operator.id}>
              {operator.name}
            </SelectItem>
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
            { id: "desktop", name: t("workspace.segments.desktop") },
            { id: "phone", name: t("workspace.segments.phone") },
          ].map((operator) => (
            <SelectItem key={operator.id} value={operator.id}>
              {operator.name}
            </SelectItem>
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

type TSurveyInteractionFilterProps = TBaseFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentSurveyInteractionFilter;
};

function SurveyInteractionFilter({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  segment,
  setSegment,
  viewOnly,
}: TSurveyInteractionFilterProps) {
  const { t } = useTranslation();
  // Pin to the concrete value type: the filter's `value` field is inferred from a refined Zod schema,
  // which TypeScript does not treat as a plain (spreadable) object without this annotation.
  const value: TSegmentSurveyInteractionFilterValue = resource.value;
  const [surveys, setSurveys] = useState<{ id: string; name: string; status: string }[]>([]);

  // Load the workspace's surveys once so the "specific surveys" picker is ready the moment the user
  // switches scope. Self-fetching here avoids prop-drilling surveys through the four SegmentEditor
  // render sites.
  useEffect(() => {
    let active = true;
    getSurveysForSegmentFilterAction({ workspaceId: segment.workspaceId }).then((result) => {
      if (active && result?.data) {
        setSurveys(result.data);
      }
    });
    return () => {
      active = false;
    };
  }, [segment.workspaceId]);

  const commitValue = (newValue: TSegmentSurveyInteractionFilterValue) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateSurveyInteractionValueInFilter(updatedSegment.filters, resource.id, newValue);
    }
    setSegment(updatedSegment);
  };

  const updateOperatorInSegment = (newOperator: TSurveyInteractionOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, resource.id, newOperator);
    }
    setSegment(updatedSegment);
  };

  const operatorArr = SURVEY_INTERACTION_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator, t),
  }));

  const getTimeUnitLabel = (unit: TSurveyInteractionTimeUnit, amount: number) => {
    const isSingular = amount === 1;
    switch (unit) {
      case "days":
        return isSingular ? t("workspace.segments.time_unit_day") : t("workspace.segments.time_unit_days");
      case "weeks":
        return isSingular ? t("workspace.segments.time_unit_week") : t("workspace.segments.time_unit_weeks");
      case "months":
        return isSingular
          ? t("workspace.segments.time_unit_month")
          : t("workspace.segments.time_unit_months");
    }
  };

  // Exclude the surveys this segment already gates (in the survey editor that's the survey being
  // edited): targeting a segment by interaction with a survey it controls is circular.
  const excludedSurveyIds = new Set(segment.surveys ?? []);
  const surveyOptions = surveys
    .filter((survey) => !excludedSurveyIds.has(survey.id))
    .map((survey) => ({
      // Name is the primary label (id beneath it as secondary); search matches both name and id.
      value: survey.id,
      label: survey.name || survey.id,
      description: survey.id,
    }));

  const handleAmountChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(999, Math.max(1, parsed));
    commitValue({ ...value, within: { ...value.within, amount: clamped } });
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
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
          onValueChange={(operator: TSurveyInteractionOperator) => {
            updateOperatorInSegment(operator);
          }}
          value={resource.qualifier.operator}>
          <SelectTrigger
            aria-label={t("workspace.segments.survey_interaction")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>

          <SelectContent>
            {operatorArr.map((operator) => (
              <SelectItem key={operator.id} value={operator.id}>
                {operator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={viewOnly}
          onValueChange={(scope: "any" | "specific") => {
            commitValue({ ...value, surveyScope: scope });
          }}
          value={value.surveyScope}>
          <SelectTrigger
            aria-label={t("common.surveys")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="any">{t("workspace.segments.any_survey")}</SelectItem>
            <SelectItem value="specific">{t("workspace.segments.specific_surveys")}</SelectItem>
          </SelectContent>
        </Select>

        <p className="whitespace-nowrap text-slate-600">{t("workspace.segments.within_last")}</p>

        <Input
          aria-label={t("workspace.segments.number")}
          className="h-9 w-16 bg-white"
          disabled={viewOnly}
          max={999}
          min={1}
          onChange={(e) => {
            if (viewOnly) return;
            handleAmountChange(e.target.value);
          }}
          step={1}
          type="number"
          value={value.within.amount}
        />

        <Select
          disabled={viewOnly}
          onValueChange={(unit: TSurveyInteractionTimeUnit) => {
            commitValue({ ...value, within: { ...value.within, unit } });
          }}
          value={value.within.unit}>
          <SelectTrigger
            aria-label={t("workspace.segments.period")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue>{getTimeUnitLabel(value.within.unit, value.within.amount)}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            {SURVEY_INTERACTION_TIME_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {getTimeUnitLabel(unit, value.within.amount)}
              </SelectItem>
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

      {value.surveyScope === "specific" ? (
        <div className="ml-[48px] flex flex-col gap-1 rounded-lg border border-slate-300 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">{t("common.surveys")}</p>
          <MultiSelect
            disabled={viewOnly}
            onChange={(selected) => {
              commitValue({ ...value, surveyIds: selected });
            }}
            options={surveyOptions}
            placeholder={t("common.select")}
            value={value.surveyIds}
          />
          {value.surveyIds.length === 0 ? (
            <p className="text-xs text-red-500">{t("workspace.segments.select_at_least_one_survey")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SegmentFilter({
  resource,
  connector,
  segment,
  segments,
  contactAttributeKeys,
  setSegment,
  handleAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  viewOnly = false,
}: TSegmentFilterProps) {
  const { t } = useTranslation();
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const updateFilterValueInSegment = (filterId: string, newValue: TSegmentFilterValue) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateFilterValue(updatedSegment.filters, filterId, newValue);
    }

    setSegment(updatedSegment);
  };

  const onAddFilterBelow = () => {
    setAddFilterModalOpen(true);
  };

  const filterModal = (
    <AddFilterModal
      contactAttributeKeys={contactAttributeKeys}
      onAddFilter={(filter) => {
        handleAddFilterBelow(resource.id, filter);
      }}
      open={addFilterModalOpen}
      segments={segments}
      setOpen={setAddFilterModalOpen}
    />
  );

  switch (resource.root.type) {
    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            contactAttributeKeys={contactAttributeKeys}
            connector={connector}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentAttributeFilter}
            segment={segment}
            setSegment={setSegment}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />

          {filterModal}
        </>
      );

    case "person":
      return (
        <>
          <PersonSegmentFilter
            connector={connector}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentPersonFilter}
            segment={segment}
            setSegment={setSegment}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />

          {filterModal}
        </>
      );

    case "segment":
      return (
        <>
          <SegmentSegmentFilter
            connector={connector}
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

          {filterModal}
        </>
      );

    case "device":
      return (
        <>
          <DeviceFilter
            connector={connector}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentDeviceFilter}
            segment={segment}
            setSegment={setSegment}
            viewOnly={viewOnly}
          />

          {filterModal}
        </>
      );

    case "surveyInteraction":
      return (
        <>
          <SurveyInteractionFilter
            connector={connector}
            onAddFilterBelow={onAddFilterBelow}
            onCreateGroup={onCreateGroup}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            resource={resource as TSegmentSurveyInteractionFilter}
            segment={segment}
            setSegment={setSegment}
            viewOnly={viewOnly}
          />

          {filterModal}
        </>
      );

    default:
      return <div>{t("workspace.segments.unknown_filter_type")}</div>;
  }
}
