"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { type JSX, useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyMatrixElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { MatrixSortableItem } from "@/modules/survey/editor/components/matrix-sortable-item";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface MatrixElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyMatrixElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyMatrixElement>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const MatrixElementForm = ({
  element,
  elementIdx,
  updateElement,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: MatrixElementFormProps): JSX.Element => {
  const languageCodes = extractLanguageCodes(localSurvey.languages);
  const { t } = useTranslation();

  const focusItem = (targetIdx: number, type: "row" | "column") => {
    const input = document.querySelector(`input[id="${type}-${targetIdx}"]`) as HTMLInputElement;
    if (input) input.focus();
  };

  // Function to add a new Label input field
  const handleAddLabel = (type: "row" | "column") => {
    if (type === "row") {
      const updatedRows = [...element.rows, { id: createId(), label: createI18nString("", languageCodes) }];
      updateElement(elementIdx, { rows: updatedRows });
      setTimeout(() => focusItem(updatedRows.length - 1, type), 0);
    } else {
      const updatedColumns = [
        ...element.columns,
        { id: createId(), label: createI18nString("", languageCodes) },
      ];
      updateElement(elementIdx, { columns: updatedColumns });
      setTimeout(() => focusItem(updatedColumns.length - 1, type), 0);
    }
  };

  // Function to delete a label input field
  const handleDeleteLabel = (type: "row" | "column", index: number) => {
    const labels = type === "row" ? element.rows : element.columns;
    if (labels.length <= 2) return; // Prevent deleting below minimum length

    // check if the label is used in logic
    if (type === "column") {
      const elementIdx = findOptionUsedInLogic(localSurvey, element.id, index.toString());
      if (elementIdx !== -1) {
        toast.error(
          t("environments.surveys.edit.column_used_in_logic_error", {
            questionIndex: elementIdx + 1,
          })
        );
        return;
      }
    } else {
      const elementIdx = findOptionUsedInLogic(localSurvey, element.id, index.toString(), true);
      if (elementIdx !== -1) {
        toast.error(
          t("environments.surveys.edit.row_used_in_logic_error", {
            questionIndex: elementIdx + 1,
          })
        );
        return;
      }
    }

    const updatedLabels = labels.filter((_, idx) => idx !== index);

    if (type === "row") {
      updateElement(elementIdx, { rows: updatedLabels });
    } else {
      updateElement(elementIdx, { columns: updatedLabels });
    }
  };

  const updateMatrixLabel = (index: number, type: "row" | "column", matrixLabel: TI18nString) => {
    const labels = type === "row" ? [...element.rows] : [...element.columns];

    // Update the label at the given index, or add a new label if index is undefined
    if (index !== undefined) {
      labels[index].label = matrixLabel;
    } else {
      labels.push({ id: createId(), label: matrixLabel });
    }
    if (type === "row") {
      updateElement(elementIdx, { rows: labels });
    } else {
      updateElement(elementIdx, { columns: labels });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "row" | "column", currentIndex: number) => {
    const items = type === "row" ? element.rows : element.columns;

    if (e.key === "Enter") {
      e.preventDefault();
      if (currentIndex === items.length - 1) {
        handleAddLabel(type);
      } else {
        focusItem(currentIndex + 1, type);
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex + 1 < items.length) {
        focusItem(currentIndex + 1, type);
      }
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex > 0) {
        focusItem(currentIndex - 1, type);
      }
    }
  };

  const handleMatrixDragEnd = useCallback(
    (type: "row" | "column", event: DragEndEvent) => {
      const { active, over } = event;

      if (!active || !over || active.id === over.id) return;

      const items = type === "row" ? [...element.rows] : [...element.columns];
      const activeIndex = items.findIndex((item) => item.id === active.id);
      const overIndex = items.findIndex((item) => item.id === over.id);

      if (activeIndex === -1 || overIndex === -1) return;

      const movedItem = items[activeIndex];
      items.splice(activeIndex, 1);
      items.splice(overIndex, 0, movedItem);

      updateElement(elementIdx, type === "row" ? { rows: items } : { columns: items });
    },
    [elementIdx, updateElement, element.rows, element.columns]
  );

  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: t("environments.surveys.edit.keep_current_order"),
      show: true,
    },
    all: {
      id: "all",
      label: t("environments.surveys.edit.randomize_all"),
      show: true,
    },
    exceptLast: {
      id: "exceptLast",
      label: t("environments.surveys.edit.randomize_all_except_last"),
      show: true,
    },
  };
  const [parent] = useAutoAnimate();

  return (
    <form>
      <ElementFormInput
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        elementIdx={elementIdx}
        isInvalid={isInvalid}
        updateElement={updateElement}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />
      <div ref={parent}>
        {element.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <ElementFormInput
                id="subheader"
                value={element.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={updateElement}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
                isExternalUrlsAllowed={isExternalUrlsAllowed}
              />
            </div>
          </div>
        )}
        {element.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateElement(elementIdx, {
                subheader: createI18nString("", languageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          {/* Rows section */}
          <Label htmlFor="rows">{t("environments.surveys.edit.rows")}</Label>
          <div className="mt-2">
            <DndContext id="matrix-rows" onDragEnd={(e) => handleMatrixDragEnd("row", e)}>
              <SortableContext items={element.rows} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {element.rows.map((row, index) => (
                    <MatrixSortableItem
                      key={row.id}
                      choice={row}
                      index={index}
                      type="row"
                      localSurvey={localSurvey}
                      element={element}
                      elementIdx={elementIdx}
                      updateMatrixLabel={updateMatrixLabel}
                      onDelete={(index) => handleDeleteLabel("row", index)}
                      onKeyDown={(e) => handleKeyDown(e, "row", index)}
                      canDelete={element.rows.length > 2}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      isInvalid={
                        isInvalid &&
                        !isLabelValidForAllLanguages(element.rows[index].label, localSurvey.languages)
                      }
                      locale={locale}
                      isStorageConfigured={isStorageConfigured}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-fit"
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("row");
              }}>
              <PlusIcon />
              {t("environments.surveys.edit.add_row")}
            </Button>
          </div>
        </div>
        <div>
          {/* Columns section */}
          <Label htmlFor="columns">{t("environments.surveys.edit.columns")}</Label>
          <div className="mt-2">
            <DndContext id="matrix-columns" onDragEnd={(e) => handleMatrixDragEnd("column", e)}>
              <SortableContext items={element.columns} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {element.columns.map((column, index) => (
                    <MatrixSortableItem
                      key={column.id}
                      choice={column}
                      index={index}
                      type="column"
                      localSurvey={localSurvey}
                      element={element}
                      elementIdx={elementIdx}
                      updateMatrixLabel={updateMatrixLabel}
                      onDelete={(index) => handleDeleteLabel("column", index)}
                      onKeyDown={(e) => handleKeyDown(e, "column", index)}
                      canDelete={element.columns.length > 2}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      isInvalid={
                        isInvalid &&
                        !isLabelValidForAllLanguages(element.columns[index].label, localSurvey.languages)
                      }
                      locale={locale}
                      isStorageConfigured={isStorageConfigured}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-fit"
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("column");
              }}>
              <PlusIcon />
              {t("environments.surveys.edit.add_column")}
            </Button>
          </div>
          <div className="mt-3 flex flex-1 items-center justify-end gap-2">
            <ShuffleOptionSelect
              shuffleOptionsTypes={shuffleOptionsTypes}
              elementIdx={elementIdx}
              updateElement={updateElement}
              shuffleOption={element.shuffleOption}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
