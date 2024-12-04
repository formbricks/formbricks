import { Switch } from "@/modules/ui/components/switch";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { capitalize } from "lodash";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { QUESTIONS_ICON_MAP } from "@formbricks/lib/utils/questions";
import { TSurvey } from "@formbricks/types/surveys/types";

interface DataTableSettingsModalItemProps<T> {
  column: Column<T, unknown>;
  survey?: TSurvey;
}

export const DataTableSettingsModalItem = <T,>({ column, survey }: DataTableSettingsModalItemProps<T>) => {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

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
