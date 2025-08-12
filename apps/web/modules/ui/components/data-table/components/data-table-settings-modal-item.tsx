"use client";

import { COLUMNS_ICON_MAP } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/lib/utils";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getQuestionIconMap } from "@/modules/survey/lib/questions";
import { Switch } from "@/modules/ui/components/switch";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { useTranslate } from "@tolgee/react";
import { capitalize } from "lodash";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface DataTableSettingsModalItemProps<T> {
  column: Column<T, unknown>;
  survey?: TSurvey;
}

const getColumnIcon = (columnId: string) => {
  const Icon = COLUMNS_ICON_MAP[columnId];
  if (Icon) {
    return (
      <span className="h-4 w-4" aria-hidden="true">
        <Icon className="h-4 w-4" aria-hidden="true" focusable="false" />
      </span>
    );
  }
  return null;
};

export const DataTableSettingsModalItem = <T,>({ column, survey }: DataTableSettingsModalItemProps<T>) => {
  const { t } = useTranslate();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });
  const isOptionIdColumn = column.id.endsWith("optionIds");

  const getOptionIdColumnLabel = () => {
    const questionId = column.id.split("optionIds")[0];
    const question = survey?.questions.find((q) => q.id === questionId);
    if (question) {
      return `${getLocalizedValue(question.headline, "default")} - ${t("common.option_id")}`;
    }
    return null;
  };

  const getLabelFromColumnId = () => {
    switch (column.id) {
      case "createdAt":
        return t("common.date");
      case "addressLine1":
        return t("environments.surveys.edit.address_line_1");
      case "addressLine2":
        return t("environments.surveys.edit.address_line_2");
      case "city":
        return t("environments.surveys.edit.city");
      case "state":
        return t("environments.surveys.edit.state");
      case "zip":
        return t("environments.surveys.edit.zip");
      case "verifiedEmail":
        return t("common.verified_email");
      case "userId":
        return t("common.user_id");
      case "contactsTableUser":
        return "ID";
      case "firstName":
        return t("environments.contacts.first_name");
      case "lastName":
        return t("environments.contacts.last_name");
      case "action":
        return t("common.action");
      case "country":
        return t("environments.surveys.responses.country");
      case "os":
        return t("environments.surveys.responses.os");
      case "device":
        return t("environments.surveys.responses.device");
      case "browser":
        return t("environments.surveys.responses.browser");
      case "url":
        return t("common.url");
      case "source":
        return t("environments.surveys.responses.source");

      default:
        return capitalize(column.id);
    }
  };

  const question = survey?.questions.find((question) => question.id === column.id);

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  const iconMemo = useMemo(() => {
    return getColumnIcon(column.id);
  }, [column.id]);

  return (
    <div ref={setNodeRef} style={style} id={column.id}>
      <div {...listeners} {...attributes}>
        <div
          key={column.id}
          className="flex w-full items-center justify-between gap-4 rounded-md p-1.5 hover:cursor-move hover:bg-slate-100">
          <div className="flex items-center space-x-2 overflow-hidden">
            <button type="button" aria-label="Reorder column" onClick={(e) => e.preventDefault()}>
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex items-center space-x-2 overflow-hidden">
              {question ? (
                <>
                  <span className="h-4 w-4" aria-hidden="true">
                    {QUESTIONS_ICON_MAP[question.type]}
                  </span>
                  <span className="truncate">{getLocalizedValue(question.headline, "default")}</span>
                </>
              ) : (
                <>
                  {iconMemo}
                  <span className="truncate">
                    {isOptionIdColumn ? getOptionIdColumnLabel() : getLabelFromColumnId()}
                  </span>
                </>
              )}
            </div>
          </div>
          <Switch
            id={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
};
