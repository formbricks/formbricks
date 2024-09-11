import { SurveyInlineProps } from "@formbricks/types/formbricks-surveys";
import { Survey } from "./Survey";

export const SurveyInline = (props: SurveyInlineProps) => {
  console.log("props SurveyInlineProps= ", props);
  return (
    <div
      id="fbjs"
      className="fb-formbricks-form abc"
      style={{
        height: "100%",
        width: "100%",
      }}>
      <Survey {...props} />
    </div>
  );
};
