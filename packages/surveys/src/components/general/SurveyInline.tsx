import { SurveyInlineProps } from "@formbricks/types/formbricksSurveys";
import { Survey } from "./Survey";

export const SurveyInline = (props: SurveyInlineProps) => {
  return (
    <div id="fbjs" className="fb-formbricks-form fb-h-full fb-w-full">
      <Survey {...props} />
    </div>
  );
};
