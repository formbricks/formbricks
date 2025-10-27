import DOMPurify from "isomorphic-dompurify";
import { useTranslation } from "react-i18next";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { isValidHTML } from "@/lib/html-utils";

interface HeadlineProps {
  headline: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
}

export function Headline({ headline, questionId, required = true, alignTextCenter = false }: HeadlineProps) {
  const { t } = useTranslation();
  const isHeadlineHtml = isValidHTML(headline);
  const safeHtml = isHeadlineHtml && headline ? DOMPurify.sanitize(headline, { ADD_ATTR: ["target"] }) : "";

  return (
    <label htmlFor={questionId} className="fb-text-heading fb-mb-[3px] fb-flex fb-flex-col">
      {!required && (
        <span
          className="fb-text-xs fb-opacity-60 fb-font-normal fb-leading-6 fb-mb-[3px]"
          tabIndex={-1}
          data-testid="fb__surveys__headline-optional-text-test">
          {t("common.optional")}
        </span>
      )}
      <div
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}
        dir="auto">
        {isHeadlineHtml ? (
          <div
            data-testid="fb__surveys__headline-text-test"
            className="fb-htmlbody fb-text-base"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p data-testid="fb__surveys__headline-text-test" className="fb-text-base fb-font-semibold">
            {headline}
          </p>
        )}
      </div>
    </label>
  );
}
