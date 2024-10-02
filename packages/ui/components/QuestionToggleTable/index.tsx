import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { Switch } from "../Switch";

interface QuestionToggleTableProps {
  type: "address" | "contact";
  fields: {
    required: boolean;
    show: boolean;
    id: string;
    label: string;
  }[];
  onShowToggle: (
    field: {
      id: string;
      required: boolean;
      show: boolean;
    },
    show: boolean
  ) => void;
  onRequiredToggle: (
    field: {
      id: string;
      show: boolean;
      required: boolean;
    },
    required: boolean
  ) => void;
}

export const QuestionToggleTable = ({
  type,
  fields,
  onShowToggle,
  onRequiredToggle,
}: QuestionToggleTableProps) => {
  return (
    <table className="mt-4 w-1/2 table-fixed">
      <thead>
        <tr className="text-left text-slate-800">
          <th className="w-1/2 text-sm font-semibold">{capitalizeFirstLetter(type)} Fields</th>
          <th className="w-1/4 text-sm font-semibold">Show</th>
          <th className="w-1/4 text-sm font-semibold">Required</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr className="text-slate-900">
            <td className="py-2 text-sm">{field.label}</td>
            <td className="py-">
              <Switch
                checked={field.show}
                onCheckedChange={(show) => {
                  onShowToggle(field, show);
                }}
                disabled={
                  // if all the other fields are hidden, this should be disabled
                  fields.filter((currentField) => currentField.id !== field.id).every((field) => !field.show)
                }
              />
            </td>
            <td className="py-2">
              <Switch
                checked={field.required}
                onCheckedChange={(required) => {
                  onRequiredToggle(field, required);
                }}
                disabled={!field.show}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
