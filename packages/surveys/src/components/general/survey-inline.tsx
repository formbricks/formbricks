import { type SurveyInlineProps } from "@formbricks/types/formbricks-surveys";
import { Survey } from "./survey";

export function SurveyInline(props: SurveyInlineProps) {
  return (
    <div
      id="fbjs"
      className="fb-formbricks-form"
      style={{
        height: "100%",
        width: "100%",
      }}>
      <Survey {...props} />
    </div>
  );
}
