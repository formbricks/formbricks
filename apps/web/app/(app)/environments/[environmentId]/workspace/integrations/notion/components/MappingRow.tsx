"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ERRORS,
  TYPE_MAPPING,
  UNSUPPORTED_TYPES_BY_NOTION,
} from "@/app/(app)/environments/[environmentId]/workspace/integrations/notion/constants";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { getElementTypes } from "@/modules/survey/lib/elements";
import { Button } from "@/modules/ui/components/button";
import { DropdownSelector } from "@/modules/ui/components/dropdown-selector";

const filterByIdx = (targetIdx: number) => (_: unknown, i: number) => i !== targetIdx;

export type TColumnOrElement = { id: string; name: string; type: string };
export type TMappingError = { type: string; msg?: React.ReactNode | string } | null;
export type TMapping = {
  id: string;
  column: TColumnOrElement;
  element: TColumnOrElement;
  error?: TMappingError;
};

export const createEmptyMapping = (): TMapping => ({
  id: crypto.randomUUID(),
  column: { id: "", name: "", type: "" },
  element: { id: "", name: "", type: "" },
});

const MappingErrorMessage = ({
  error,
  col,
  elem,
  t,
}: {
  error: TMappingError | undefined;
  col: TColumnOrElement;
  elem: TColumnOrElement;
  t: ReturnType<typeof useTranslation>["t"];
}) => {
  const showErrorMsg = useMemo(() => {
    switch (error?.type) {
      case ERRORS.UNSUPPORTED_TYPE: {
        return (
          <>
            -{" "}
            {t("environments.integrations.notion.col_name_of_type_is_not_supported", {
              col_name: col.name,
              type: col.type,
            })}
          </>
        );
      }
      case ERRORS.MAPPING: {
        const element = getElementTypes(t).find((et) => et.id === elem.type);
        if (!element) return null;
        return (
          <>
            {t("environments.integrations.notion.que_name_of_type_cant_be_mapped_to", {
              que_name: elem.name,
              question_label: element.label,
              col_name: col.name,
              col_type: col.type,
              mapped_type: TYPE_MAPPING[element.id].join(" ,"),
            })}
          </>
        );
      }
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, col, elem, t]);

  if (!error) return null;

  return (
    <div className="my-4 w-full rounded-lg bg-red-100 p-4 text-sm text-red-800">
      <span className="mb-2 block">{error.type}</span>
      {showErrorMsg}
    </div>
  );
};

interface MappingRowProps {
  idx: number;
  mapping: TMapping[];
  setMapping: React.Dispatch<React.SetStateAction<TMapping[]>>;
  filteredElementItems: TColumnOrElement[];
  dbItems: TColumnOrElement[];
  elementItems: TColumnOrElement[];
  t: ReturnType<typeof useTranslation>["t"];
}

export const MappingRow = ({
  idx,
  mapping,
  setMapping,
  filteredElementItems,
  dbItems,
  elementItems,
  t,
}: MappingRowProps) => {
  const createCopy = (items: TMapping[]) => structuredClone(items);

  const addRow = () => {
    setMapping((prev) => [...prev, createEmptyMapping()]);
  };

  const deleteRow = () => {
    setMapping((prev) => prev.filter(filterByIdx(idx)));
  };

  const getFilteredDbItems = () => {
    const colMapping = new Set(mapping.map((m) => m.column.id));
    return dbItems.filter((item) => !colMapping.has(item.id));
  };

  const handleElementSelect = (item: TColumnOrElement) => {
    setMapping((prev) => {
      const copy = createCopy(prev);
      const col = copy[idx].column;

      if (col.id) {
        if (UNSUPPORTED_TYPES_BY_NOTION.includes(col.type)) {
          copy[idx] = {
            ...copy[idx],
            error: { type: ERRORS.UNSUPPORTED_TYPE },
            element: item,
          };
          return copy;
        }

        const isValidColType = TYPE_MAPPING[item.type].includes(col.type);
        if (!isValidColType) {
          copy[idx] = {
            ...copy[idx],
            error: { type: ERRORS.MAPPING },
            element: item,
          };
          return copy;
        }
      }

      copy[idx] = { ...copy[idx], element: item, error: null };
      return copy;
    });
  };

  const handleColumnSelect = (item: TColumnOrElement) => {
    setMapping((prev) => {
      const copy = createCopy(prev);
      const elem = copy[idx].element;

      if (elem.id) {
        if (UNSUPPORTED_TYPES_BY_NOTION.includes(item.type)) {
          copy[idx] = {
            ...copy[idx],
            error: { type: ERRORS.UNSUPPORTED_TYPE },
            column: item,
          };
          return copy;
        }

        const isValidElemType = TYPE_MAPPING[elem.type].includes(item.type);
        if (!isValidElemType) {
          copy[idx] = {
            ...copy[idx],
            error: { type: ERRORS.MAPPING },
            column: item,
          };
          return copy;
        }
      }

      copy[idx] = { ...copy[idx], column: item, error: null };
      return copy;
    });
  };

  return (
    <div className="w-full">
      <MappingErrorMessage
        error={mapping[idx]?.error}
        col={mapping[idx].column}
        elem={mapping[idx].element}
        t={t}
      />
      <div className="flex w-full items-center space-x-2">
        <div className="flex w-full items-center">
          <div className="max-w-full flex-1">
            <DropdownSelector
              placeholder={t("environments.integrations.notion.select_a_survey_question")}
              items={filteredElementItems}
              selectedItem={mapping?.[idx]?.element}
              setSelectedItem={handleElementSelect}
              disabled={elementItems.length === 0}
            />
          </div>
          <div className="h-px w-4 border-t border-t-slate-300" />
          <div className="max-w-full flex-1">
            <DropdownSelector
              placeholder={t("environments.integrations.notion.select_a_field_to_map")}
              items={getFilteredDbItems()}
              selectedItem={mapping?.[idx]?.column}
              setSelectedItem={handleColumnSelect}
              disabled={dbItems.length === 0}
            />
          </div>
        </div>
        <div className="flex space-x-2">
          {mapping.length > 1 && (
            <Button variant="secondary" size="icon" className="size-10" onClick={deleteRow}>
              <TrashIcon />
            </Button>
          )}
          <Button variant="secondary" size="icon" className="size-10" onClick={addRow}>
            <PlusIcon />
          </Button>
        </div>
      </div>
    </div>
  );
};
