import DOMPurify from "isomorphic-dompurify";
import { useTranslation } from "react-i18next";
import { isValidHTML, stripInlineStyles } from "@/lib/html-utils";

interface HeadlineProps {
  headline: string;
  elementId: string;
  required?: boolean;
  alignTextCenter?: boolean;
}

export function Headline({
  headline,
  elementId,
  required = false,
  alignTextCenter = false,
}: Readonly<HeadlineProps>) {
  const hasRequiredRule = required;
  const { t } = useTranslation();
  const isQuestionCard = elementId !== "EndingCard" && elementId !== "welcomeCard";
  // Welcome / ending cards are the top of the screen (h1); question cards sit
  // under the survey form region, so their prompt is an h2.
  const headingLevel = isQuestionCard ? 2 : 1;
  const HeadingTag = isQuestionCard ? "h2" : "h1";
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
    <div className="text-heading mb-[3px] flex flex-col">
      {hasRequiredRule && isQuestionCard && (
        <span
          className="label-card mb-[3px] text-xs leading-6 font-normal"
          tabIndex={-1}
          data-testid="fb__surveys__headline-optional-text-test">
          {t("common.required")}
        </span>
      )}
      <div
        className={`flex items-center ${alignTextCenter ? "justify-center" : "justify-between"}`}
        dir="auto">
        {isHeadlineHtml ? (
          // Rich-text headlines can contain block elements, so they can't live
          // inside a real heading tag; expose the heading semantics via ARIA.
          <div
            role="heading"
            aria-level={headingLevel}
            data-testid="fb__surveys__headline-text-test"
            className="label-headline htmlbody text-base"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <HeadingTag
            data-testid="fb__surveys__headline-text-test"
            className="label-headline text-base font-semibold">
            {headline}
          </HeadingTag>
        )}
      </div>
    </div>
  );
}
