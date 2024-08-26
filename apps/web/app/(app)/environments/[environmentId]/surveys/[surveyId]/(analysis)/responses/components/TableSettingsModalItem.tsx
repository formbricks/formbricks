import { TTableData } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/Columns";
import { QUESTIONS_ICON_MAP } from "@/app/lib/questions";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { capitalize } from "lodash";
import { GripVertical } from "lucide-react";
import React from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Switch } from "@formbricks/ui/Switch";

interface TableSettingsModalItemProps {
  column: Column<TTableData, unknown>;
  survey: TSurvey;
}

export const TableSettingsModalItem = ({ column, survey }: TableSettingsModalItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const getLabelFromColumnId = () => {
    switch (column.id) {
      case "createdAt":
        return "Date";
      case "addressLine1":
        return "Address Line 1";
      case "addressLine2":
        return "Address Line 2";
      case "city":
        return "City / Town";
      case "state":
        return "State / Region";
      case "zip":
        return "ZIP / Post Code";
      case "verifiedEmail":
        return "Verified Email";
      default:
        return capitalize(column.id);
    }
  };

  const question = survey.questions.find((question) => question.id === column.id);

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} id={column.id}>
      <div {...listeners} {...attributes}>
        <div key={column.id} className="flex w-full justify-between">
          <div className="flex items-center space-x-2">
            <button className="hover:cursor-move group-hover:opacity-100" onClick={(e) => e.preventDefault()}>
              <GripVertical className="h-4 w-4" />
            </button>
            {question ? (
              <div className="flex items-center space-x-2">
                <span className="h-4 w-4">{QUESTIONS_ICON_MAP[question.type]}</span>
                <span className="max-w-xs truncate">{getLocalizedValue(question.headline, "default")}</span>
              </div>
            ) : (
              <span className="max-w-xs truncate">{getLabelFromColumnId()}</span>
            )}
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
