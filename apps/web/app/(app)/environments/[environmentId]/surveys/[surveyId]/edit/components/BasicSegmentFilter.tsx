import { MoreVertical, TagIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import z from "zod";

import { cn } from "@formbricks/lib/cn";
import {
  convertOperatorToText,
  convertOperatorToTitle,
  toggleFilterConnector,
  updateAttributeClassNameInFilter,
  updateFilterValue,
  updateOperatorInFilter,
} from "@formbricks/lib/userSegment/utils";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import {
  ARITHMETIC_OPERATORS,
  ATTRIBUTE_OPERATORS,
  TArithmeticOperator,
  TAttributeOperator,
  TUserSegment,
  TUserSegmentAttributeFilter,
  TUserSegmentConnector,
  TUserSegmentFilter,
  TUserSegmentFilterValue,
} from "@formbricks/types/userSegment";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Input } from "@formbricks/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

type SegmentFilterItemProps = {
  connector: TUserSegmentConnector;
  resource: TUserSegmentFilter;
  environmentId: string;
  userSegment: TUserSegment;
  attributeClasses: TAttributeClass[];
  setUserSegment: (userSegment: TUserSegment) => void;
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
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment.filters) {
      toggleFilterConnector(updatedUserSegment.filters, filterId, newConnector);
    }

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
      <span
        className={cn(!!connector && "cursor-pointer underline")}
        onClick={() => {
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
}: {
  filterId: string;
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
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "up")}>Move up</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMoveFilter(filterId, "down")}>Move down</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="minimal"
        className="mr-4 p-0"
        onClick={() => {
          onDeleteFilter(filterId);
        }}>
        <Trash2 className={cn("h-4 w-4 cursor-pointer")}></Trash2>
      </Button>
    </div>
  );
};

type TAttributeSegmentFilterProps = SegmentFilterItemProps & {
  resource: TUserSegmentAttributeFilter;
  updateValueInLocalSurvey: (filterId: string, newValue: TUserSegmentFilterValue) => void;
};

const AttributeSegmentFilter = ({
  connector,
  resource,
  onDeleteFilter,
  onMoveFilter,
  updateValueInLocalSurvey,
  userSegment,
  setUserSegment,
  attributeClasses,
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
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment.filters) {
      updateOperatorInFilter(updatedUserSegment.filters, filterId, newOperator);
    }

    setUserSegment(updatedUserSegment);
  };

  const updateAttributeClassNameInLocalSurvey = (filterId: string, newAttributeClassName: string) => {
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment.filters) {
      updateAttributeClassNameInFilter(updatedUserSegment.filters, filterId, newAttributeClassName);
    }

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
          updateAttributeClassNameInLocalSurvey(resource.id, value);
        }}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue hidden />
          <div className="flex items-center gap-1">
            <TagIcon className="h-4 w-4 text-sm" />
            <p>{attributeClass}</p>
          </div>
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
        }}>
        <SelectTrigger className="flex w-auto items-center justify-center bg-white text-center" hideArrow>
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

      {!["isSet", "isNotSet"].includes(resource.qualifier.operator) && (
        <div className="relative flex flex-col gap-1">
          <Input
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
      />
    </div>
  );
};

const BasicSegmentFilter = ({
  resource,
  connector,
  environmentId,
  userSegment,
  attributeClasses,
  setUserSegment,
  onDeleteFilter,
  onMoveFilter,
}: SegmentFilterItemProps) => {
  const updateFilterValueInUserSegment = (filterId: string, newValue: string | number) => {
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment.filters) {
      updateFilterValue(updatedUserSegment.filters, filterId, newValue);
    }

    setUserSegment(updatedUserSegment);
  };

  switch (resource.root.type) {
    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            connector={connector}
            resource={resource as TUserSegmentAttributeFilter}
            environmentId={environmentId}
            userSegment={userSegment}
            attributeClasses={attributeClasses}
            setUserSegment={setUserSegment}
            onDeleteFilter={onDeleteFilter}
            onMoveFilter={onMoveFilter}
            updateValueInLocalSurvey={updateFilterValueInUserSegment}
          />
        </>
      );
  }
};

export default BasicSegmentFilter;
