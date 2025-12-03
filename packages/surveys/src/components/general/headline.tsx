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
    <label htmlFor={elementId} className="fb-text-heading fb-mb-[3px] fb-flex fb-flex-col">
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
