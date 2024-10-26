import { useEffect, useState } from "react";
import { TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface SubheaderProps {
  subheader?: string;
  questionId: TSurveyQuestionId;
}

export const Subheader = ({ subheader, questionId }: SubheaderProps) => {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (subheader) {
      import("isomorphic-dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(subheader, { ADD_ATTR: ["target"] }));
      });
    }
  }, [subheader]);

  if (!subheader) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;
  return (
    <p
      htmlFor={questionId}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      className="fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-5"
      dir="auto"></p>
  );
};
