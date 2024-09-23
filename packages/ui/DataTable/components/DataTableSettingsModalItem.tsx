import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { capitalize } from "lodash";
import { GripVertical } from "lucide-react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { QUESTIONS_ICON_MAP, VARIABLES_ICON_MAP } from "@formbricks/lib/utils/questions";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Switch } from "../../Switch";

interface DataTableSettingsModalItemProps<T> {
  column: Column<T, unknown>;
  survey?: TSurvey;
}

export const DataTableSettingsModalItem = <T,>({ column, survey }: DataTableSettingsModalItemProps<T>) => {
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

  const question = survey?.questions.find((question) => question.id === column.id);
  const variable = survey?.variables.find((variable) => variable.id === column.id);

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  const renderLabel = () => {
    if (question) {
      return (
        <div className="flex items-center space-x-2">
          <span className="h-4 w-4">{QUESTIONS_ICON_MAP[question.type]}</span>
          <span className="max-w-xs truncate">{getLocalizedValue(question.headline, "default")}</span>
        </div>
      );
    }

    if (variable) {
      return (
        <div className="flex items-center space-x-2">
          <span className="h-4 w-4">{VARIABLES_ICON_MAP[variable.type]}</span>
          <span className="max-w-xs truncate">{variable.name}</span>
        </div>
      );
    }

    return <span className="max-w-xs truncate">{getLabelFromColumnId()}</span>;
  };

  return (
    <div ref={setNodeRef} style={style} id={column.id}>
      <div {...listeners} {...attributes}>
        <div
          key={column.id}
          className="flex w-full items-center justify-between rounded-md p-1.5 hover:cursor-move hover:bg-slate-100">
          <div className="flex items-center space-x-2">
            <button onClick={(e) => e.preventDefault()}>
              <GripVertical className="h-4 w-4" />
            </button>
            {renderLabel()}
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
