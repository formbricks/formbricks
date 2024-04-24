import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

interface SurveySwitchProps {
  value: "website" | "app";
  formbricks: any;
}

export const SurveySwitch = ({ value, formbricks }: SurveySwitchProps) => {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        formbricks.logout();
        window.location.href = `/${v}`;
      }}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="website">Website Surveys</SelectItem>
        <SelectItem value="app">App Surveys</SelectItem>
      </SelectContent>
    </Select>
  );
};
