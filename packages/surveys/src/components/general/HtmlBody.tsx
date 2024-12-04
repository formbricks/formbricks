import { useEffect, useState } from "react";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/utils";

interface HtmlBodyProps {
  htmlString?: string;
  questionId: TSurveyQuestionId;
}

export function HtmlBody({ htmlString, questionId }: HtmlBodyProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      import("isomorphic-dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(htmlString, { ADD_ATTR: ["target"] }));
      });
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;

  return (
    <label
      htmlFor={questionId}
      className={cn("fb-htmlbody fb-break-words")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
}
