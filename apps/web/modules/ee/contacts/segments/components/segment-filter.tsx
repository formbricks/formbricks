"use client";

import { cn } from "@/lib/cn";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { isCapitalized } from "@/lib/utils/strings";
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
} from "@/modules/ee/contacts/segments/lib/utils";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FingerprintIcon,
  MonitorSmartphoneIcon,
  MoreVertical,
  TagIcon,
  Trash2,
  Users2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type {
  TArithmeticOperator,
  TAttributeOperator,
  TBaseFilter,
  TDeviceOperator,
  TSegment,
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
  ARITHMETIC_OPERATORS,
  ATTRIBUTE_OPERATORS,
  DEVICE_OPERATORS,
  PERSON_OPERATORS,
} from "@formbricks/types/segment";
import { AddFilterModal } from "./add-filter-modal";

interface TSegmentFilterProps {
  connector: TSegmentConnector;
  resource: TSegmentFilter;
  environmentId: string;
  segment: TSegment;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
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
  const { t } = useTranslate();
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
        aria-label={connector ?? t("environments.segments.where")}
        className={cn(Boolean(connector) && "cursor-pointer underline", viewOnly && "cursor-not-allowed")}
        onClick={() => {
          if (viewOnly) return;
          onConnectorChange();
        }}>
        {connector ?? t("environments.segments.where")}
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
  const { t } = useTranslate();
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
            {t("environments.segments.add_filter_below")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              onCreateGroup(filterId);
            }}>
            {t("environments.segments.create_group")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "up");
            }}
            icon={<ArrowUpIcon className="h-4 w-4" />}>
            {t("common.move_up")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onMoveFilter(filterId, "down");
            }}
            icon={<ArrowDownIcon className="h-4 w-4" />}>
            {t("common.move_down")}
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
        variant="ghost">
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
  contactAttributeKeys,
  viewOnly,
}: TAttributeSegmentFilterProps) {
  const { contactAttributeKey } = resource.root;
  const { t } = useTranslate();
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
        setValueError(t("environments.segments.value_must_be_a_number"));
      }
    }
  }, [resource.qualifier, resource.value]);

  const operatorArr = ATTRIBUTE_OPERATORS.map((operator) => {
    return {
      id: operator,
      name: convertOperatorToText(operator),
    };
  });

  const attributeKey = contactAttributeKeys.find((attrKey) => attrKey.key === contactAttributeKey);

  const attrKeyValue = attributeKey?.name ?? attributeKey?.key ?? "";

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
    }

    setSegment(updatedSegment);
  };

  const checkValueAndUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    updateValueInLocalSurvey(resource.id, value);

    if (!value) {
      setValueError(t("environments.segments.value_cannot_be_empty"));
      return;
    }

    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(value);

      if (isNumber.success) {
        setValueError("");
        updateValueInLocalSurvey(resource.id, parseInt(value, 10));
      } else {
        setValueError(t("environments.segments.value_must_be_a_number"));
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
        value={attrKeyValue}>
        <SelectTrigger
          className="flex w-auto items-center justify-center whitespace-nowrap bg-white capitalize"
          hideArrow>
          <SelectValue>
            <div className={cn("flex items-center gap-2", !isCapitalized(attrKeyValue ?? "") && "lowercase")}>
              <TagIcon className="h-4 w-4 text-sm" />
              <p>{attrKeyValue}</p>
            </div>
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {contactAttributeKeys.map((attrClass) => (
            <SelectItem key={attrClass.id} value={attrClass.key}>
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
            <SelectItem title={convertOperatorToTitle(operator.id)} value={operator.id} key={operator.id}>
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
  const { t } = useTranslate();
  const [valueError, setValueError] = useState("");

  // when the operator changes, we need to check if the value is valid
  useEffect(() => {
    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(resource.value);

      if (isNumber.success) {
        setValueError("");
      } else {
        setValueError(t("environments.segments.value_must_be_a_number"));
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
      setValueError(t("environments.segments.value_cannot_be_empty"));
      return;
    }

    const { operator } = resource.qualifier;

    if (ARITHMETIC_OPERATORS.includes(operator as TArithmeticOperator)) {
      const isNumber = z.coerce.number().safeParse(value);

      if (isNumber.success) {
        setValueError("");
        updateValueInLocalSurvey(resource.id, parseInt(value, 10));
      } else {
        setValueError(t("environments.segments.value_must_be_a_number"));
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
            <SelectItem title={convertOperatorToTitle(operator.id)} value={operator.id} key={operator.id}>
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
  const { t } = useTranslate();
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
            { id: "desktop", name: t("environments.segments.desktop") },
            { id: "phone", name: t("environments.segments.phone") },
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
  contactAttributeKeys,
  setSegment,
  handleAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  viewOnly = false,
}: TSegmentFilterProps) {
  const { t } = useTranslate();
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
        contactAttributeKeys={contactAttributeKeys}
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
    case "attribute":
      return (
        <>
          <AttributeSegmentFilter
            contactAttributeKeys={contactAttributeKeys}
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
            contactAttributeKeys={contactAttributeKeys}
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
            contactAttributeKeys={contactAttributeKeys}
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
            contactAttributeKeys={contactAttributeKeys}
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
      return <div>{t("environments.segments.unknown_filter_type")}</div>;
  }
}
