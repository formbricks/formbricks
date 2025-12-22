import DOMPurify from "isomorphic-dompurify";
import { useTranslation } from "react-i18next";
import { isValidHTML, stripInlineStyles } from "@/lib/html-utils";

interface HeadlineProps {
  headline: string;
  elementId: string;
  required?: boolean;
  alignTextCenter?: boolean;
}

export function Headline({ headline, elementId, required = true, alignTextCenter = false }: HeadlineProps) {
  const { t } = useTranslation();
  const isQuestionCard = elementId !== "EndingCard" && elementId !== "welcomeCard";
  // Strip inline styles BEFORE parsing to avoid CSP violations
  const strippedHeadline = stripInlineStyles(headline);
  const isHeadlineHtml = isValidHTML(strippedHeadline);
  const safeHtml =
    isHeadlineHtml && strippedHeadline
      ? DOMPurify.sanitize(strippedHeadline, {
          ADD_ATTR: ["target"],
          FORBID_ATTR: ["style"], // Additional safeguard to remove any remaining inline styles
        })
      : "";

  return (
    <label htmlFor={elementId} className="text-heading mb-[3px] flex flex-col">
      {required && isQuestionCard && (
        <span
          className="mb-[3px] text-xs leading-6 font-normal opacity-60"
          tabIndex={-1}
          data-testid="fb__surveys__headline-optional-text-test">
          {t("common.required")}
        </span>
      )}
      <div
        className={`flex items-center ${alignTextCenter ? "justify-center" : "justify-between"}`}
        dir="auto">
        {isHeadlineHtml ? (
          <div
            data-testid="fb__surveys__headline-text-test"
            className="htmlbody text-base"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p data-testid="fb__surveys__headline-text-test" className="text-base font-semibold">
            {headline}
          </p>
        )}
      </div>
    </label>
  );
}
