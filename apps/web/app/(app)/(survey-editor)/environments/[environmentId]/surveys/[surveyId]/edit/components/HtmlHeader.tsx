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
        // Configure DOMPurify to allow style-related attributes and classes
        const config = {
          ADD_ATTR: ["target", "style", "class"],
          ADD_TAGS: ["span"],
          ALLOWED_ATTR: ["class", "style", "dir"],
        };
        setSafeHtml(DOMPurify.sanitize(htmlString as string, config));
      });
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;

  return (
    <label
      htmlFor={questionId}
      className={cn(
        "fb-break-words flex text-sm font-semibold",
        "[&_span]:inline-block [&_span]:align-baseline" // Add specific styling for spans
      )}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
};
