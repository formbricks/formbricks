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
      <SelectTrigger className="w-[180px] px-4">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="website" className="h-10 px-4 hover:bg-slate-100">
          Website Surveys
        </SelectItem>
        <SelectItem value="app" className="hover:bg-slate-10 h-10 px-4">
          App Surveys
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
