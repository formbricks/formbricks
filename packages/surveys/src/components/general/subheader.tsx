import DOMPurify from "isomorphic-dompurify";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { isValidHTML } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
  questionId: TSurveyQuestionId;
}

export function Subheader({ subheader, questionId }: SubheaderProps) {
  const isHtml = subheader ? isValidHTML(subheader) : false;
  const safeHtml = isHtml && subheader ? DOMPurify.sanitize(subheader, { ADD_ATTR: ["target"] }) : "";

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
