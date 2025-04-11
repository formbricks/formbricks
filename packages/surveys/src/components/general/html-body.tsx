import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useState } from "react";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HtmlBodyProps {
  htmlString?: string;
  questionId: TSurveyQuestionId;
}

export function HtmlBody({ htmlString, questionId }: HtmlBodyProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      setSafeHtml(DOMPurify.sanitize(htmlString, { ADD_ATTR: ["target"] }));
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="editor-paragraph"><br></p>`) return null;

  return (
    <label
      htmlFor={questionId}
      className={cn("htmlbody break-words")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
}
