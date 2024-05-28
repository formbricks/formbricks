interface SurveySwitchProps {
  value: "website" | "app";
  formbricks: any;
}

export const SurveySwitch = ({ value, formbricks }: SurveySwitchProps) => {
  return (
    <select
      value={value}
      onChange={(v) => {
        formbricks.logout();
        window.location.href = `/${v.target.value}`;
      }}>
      <option value="website" className="h-10 px-4 hover:bg-slate-100">
        Website Surveys
      </option>
      <option value="app" className="hover:bg-slate-10 h-10 px-4">
        App Surveys
      </option>
    </select>
  );
};
