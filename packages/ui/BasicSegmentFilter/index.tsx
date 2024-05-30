import { FingerprintIcon, MoreVertical, TagIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import z from "zod";

import { cn } from "@formbricks/lib/cn";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import {
  convertOperatorToText,
  convertOperatorToTitle,
  toggleFilterConnector,
  updateAttributeClassNameInFilter,
  updateFilterValue,
  updateOperatorInFilter,
  updatePersonIdentifierInFilter,
} from "@formbricks/lib/segment/utils";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import {
  ARITHMETIC_OPERATORS,
  ATTRIBUTE_OPERATORS,
  PERSON_OPERATORS,
  TArithmeticOperator,
  TAttributeOperator,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentFilter,
  TSegmentFilterValue,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";

import { Button } from "../Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../DropdownMenu";
import { Input } from "../Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Select";

type TBasicSegmentFilterProps = {
  connector: TSegmentConnector;
  resource: TSegmentFilter;
  environmentId: string;
  segment: TSegment;
  attributeClasses: TAttributeClass[];
  setSegment: (segment: TSegment) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
};

const isCapitalized = (str: string) => str.charAt(0) === str.charAt(0).toUpperCase();

const SegmentFilterItemConnector = ({
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
}) => {
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
        className={cn(!!connector && "cursor-pointer underline", viewOnly && "cursor-not-allowed")}
        onClick={() => {
          if (viewOnly) return;
          onConnectorChange();
        }}>
        {!!connector ? connector : "Where"}
      </span>
    </div>
  );
};

const SegmentFilterItemContextMenu = ({
  filterId,
  onDeleteFilter,
  onMoveFilter,
  viewOnly,
}: {
  filterId: string;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
}) => {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger disabled={viewOnly}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "up")}>Move up</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "down")}>Move down</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="minimal"
        className="mr-4 p-0"
        onClick={() => {
          onDeleteFilter(filterId);
        }}
        disabled={viewOnly}>
        <Trash2 className={cn("h-4 w-4 cursor-pointer", viewOnly && "cursor-not-allowed")}></Trash2>
      </Button>
    </div>
  );
};

type TAttributeSegmentFilterProps = TBasicSegmentFilterProps & {
  resource: TSegmentAttributeFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
};

const AttributeSegmentFilter = ({
  connector,
  resource,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  segment,
  setSegment,
  attributeClasses,
  viewOnly,
}: TAttributeSegmentFilterProps) => {
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

  const attributeClass = attributeClasses?.find((attrClass) => attrClass?.name === attributeClassName)?.name;

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
        key={connector}
        connector={connector}
        filterId={resource.id}
        setSegment={setSegment}
        segment={segment}
        viewOnly={viewOnly}
      />

      <Select
        value={attributeClass}
        onValueChange={(value) => {
          updateAttributeClassNameInLocalSurvey(resource.id, value);
        }}
        disabled={viewOnly}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue>
            <div
              className={cn("flex items-center gap-1", !isCapitalized(attributeClass ?? "") && "lowercase")}>
              <TagIcon className="h-4 w-4 text-sm" />
              <p>{attributeClass}</p>
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {attributeClasses
            ?.filter((attributeClass) => !attributeClass.archived)
            ?.map((attrClass) => (
              <SelectItem value={attrClass.name} key={attrClass.id}>
                {attrClass.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={operatorText}
        onValueChange={(operator: TAttributeOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}
        disabled={viewOnly}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id} title={convertOperatorToTitle(operator.id)}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
            disabled={viewOnly}
            value={resource.value}
            onChange={(e) => {
              checkValueAndUpdate(e);
            }}
            className={cn("w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
          />

          {valueError && (
            <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">
              {valueError}
            </p>
          )}
        </div>
      )}

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
};

type TPersonSegmentFilterProps = Omit<TBasicSegmentFilterProps, "attributeClasses"> & {
  resource: TSegmentPersonFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
};

const PersonSegmentFilter = ({
  connector,
  resource,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  segment,
  setSegment,
  viewOnly,
}: TPersonSegmentFilterProps) => {
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
        key={connector}
        connector={connector}
        filterId={resource.id}
        setSegment={setSegment}
        segment={segment}
        viewOnly={viewOnly}
      />

      <Select
        value={personIdentifier}
        onValueChange={(value) => {
          updatePersonIdentifierInLocalSurvey(resource.id, value);
        }}
        disabled={viewOnly}>
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
          <SelectItem value={personIdentifier} key={personIdentifier}>
            {personIdentifier}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={operatorText}
        onValueChange={(operator: TAttributeOperator) => {
          updateOperatorInLocalSurvey(resource.id, operator);
        }}
        disabled={viewOnly}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
          <SelectValue>
            <p>{operatorText}</p>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {operatorArr.map((operator) => (
            <SelectItem value={operator.id} title={convertOperatorToTitle(operator.id)}>
              {operator.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
            value={resource.value}
            onChange={(e) => {
              checkValueAndUpdate(e);
            }}
            className={cn("w-auto bg-white", valueError && "border border-red-500 focus:border-red-500")}
            disabled={viewOnly}
          />

          {valueError && (
            <p className="absolute right-2 -mt-1 rounded-md bg-white px-2 text-xs text-red-500">
              {valueError}
            </p>
          )}
        </div>
      )}

      <SegmentFilterItemContextMenu
        filterId={resource.id}
        onDeleteFilter={onDeleteFilter}
        onMoveFilter={onMoveFilter}
        viewOnly={viewOnly}
      />
    </div>
  );
};

export const BasicSegmentFilter = ({
  resource,
  connector,
  environmentId,
  segment,
  attributeClasses,
  setSegment,
  onDeleteFilter,
  onMoveFilter,
  viewOnly,
}: TBasicSegmentFilterProps) => {
  const updateFilterValueInSegment = (filterId: string, newValue: string | number) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateFilterValue(updatedSegment.filters, filterId, newValue);
    }

    setSegment(updatedSegment);
  };

  switch (resource.root.type) {
    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            connector={connector}
            resource={resource as TSegmentAttributeFilter}
            environmentId={environmentId}
            segment={segment}
            attributeClasses={attributeClasses}
            setSegment={setSegment}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />
        </>
      );

    case "person":
      return (
        <>
          <PersonSegmentFilter
            connector={connector}
            resource={resource as TSegmentPersonFilter}
            environmentId={environmentId}
            segment={segment}
            setSegment={setSegment}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            updateValueInLocalSurvey={updateFilterValueInSegment}
            viewOnly={viewOnly}
          />
        </>
      );

    default:
      return null;
  }
};
