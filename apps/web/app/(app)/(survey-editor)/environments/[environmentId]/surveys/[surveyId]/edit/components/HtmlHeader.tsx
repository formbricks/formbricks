import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HtmlHeaderProps {
  htmlString?: string | (string | React.JSX.Element)[];
  questionId: TSurveyQuestionId;
}

export const HtmlHeader = ({ htmlString, questionId }: HtmlHeaderProps) => {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      import("isomorphic-dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(htmlString as string, { ADD_ATTR: ["target"] }));
      });
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;

  return (
    <label
      htmlFor={questionId}
      className={cn("fb-break-words text-sm font-semibold")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
};
