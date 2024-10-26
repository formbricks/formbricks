import { useEffect, useState } from "react";
import { TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HeadlineProps {
  headline?: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
}

export const Headline = ({
  headline,
  questionId,
  required = true,
  alignTextCenter = false,
}: HeadlineProps) => {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (headline) {
      import("isomorphic-dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(headline, { ADD_ATTR: ["target"] }));
      });
    }
  }, [headline]);

  if (!headline) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;
  return (
    <label
      htmlFor={questionId}
      className="fb-text-heading fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6">
      <div
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}
        dir="auto">
        {!required && (
          <span
            className="fb-text-heading fb-mx-2 fb-self-start fb-text-sm fb-font-normal fb-leading-7 fb-opacity-60"
            tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
};
