import { FingerprintIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@formbricks/lib/cn";
import {
  convertOperatorToText,
  convertOperatorToTitle,
  updateOperatorInFilter,
  updatePersonIdentifierInFilter,
} from "@formbricks/lib/segment/utils";
import {
  ARITHMETIC_OPERATORS,
  PERSON_OPERATORS,
  TArithmeticOperator,
  TAttributeOperator,
  TSegment,
  TSegmentConnector,
  TSegmentFilterValue,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";
import { Input } from "../../Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../Select";
import { SegmentFilterItemConnector } from "./SegmentFilterItemConnector";
import { SegmentFilterItemContextMenu } from "./SegmentFilterItemContextMenu";

interface PersonSegmentFilterProps {
  connector: TSegmentConnector;
  environmentId: string;
  segment: TSegment;
  setSegment: (segment: TSegment) => void;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
  resource: TSegmentPersonFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TSegmentFilterValue) => void;
}

export const PersonSegmentFilter = ({
  connector,
  resource,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  segment,
  setSegment,
  viewOnly,
}: PersonSegmentFilterProps) => {
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
