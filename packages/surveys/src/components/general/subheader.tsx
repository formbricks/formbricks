import DOMPurify from "isomorphic-dompurify";
import { useEffect, useState } from "react";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { isValidHTML } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
  questionId: TSurveyQuestionId;
}

export function Subheader({ subheader, questionId }: SubheaderProps) {
  const [safeHtml, setSafeHtml] = useState("");
  const isHtml = subheader ? isValidHTML(subheader) : false;

  useEffect(() => {
    if (subheader && isHtml) {
      setSafeHtml(DOMPurify.sanitize(subheader, { ADD_ATTR: ["target"] }));
    }
  }, [subheader, isHtml]);

  if (!subheader) return null;

  return (
    <label
      htmlFor={questionId}
      className="fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-6"
      dir="auto">
      {isHtml ? (
        <span className="fb-htmlbody" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <span>{subheader}</span>
      )}
    </label>
  );
}
