import { SurveyInlineProps } from "@formbricks/types/formbricksSurveys";
import { Survey } from "./Survey";

export const SurveyInline = (props: SurveyInlineProps) => {
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
};
