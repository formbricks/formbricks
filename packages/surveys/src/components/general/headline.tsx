import { useTranslation } from "react-i18next";
import { FB_PART } from "@formbricks/survey-ui/parts";
import { isValidHTML, sanitizeSurveyHtml, stripInlineStyles } from "@/lib/html-utils";

interface HeadlineProps {
  headline: string;
  required?: boolean;
  alignTextCenter?: boolean;
  /**
   * Heading level this prompt is exposed at (WCAG 2.4.6). Defaults to 2: the survey name is the
   * page's only h1 (rendered once by SurveyContainer), so every card headline — welcome, element
   * prompt, ending — is one level under it.
   */
  headingLevel?: 1 | 2;
}

export function Headline({
  headline,
  required = false,
  alignTextCenter = false,
  headingLevel = 2,
}: Readonly<HeadlineProps>) {
  const hasRequiredRule = required;
  const { t } = useTranslation();
  const HeadingTag = `h${headingLevel.toString()}` as "h1" | "h2";
  // Strip inline styles BEFORE parsing to avoid CSP violations
  const strippedHeadline = stripInlineStyles(headline);
  const isHeadlineHtml = isValidHTML(strippedHeadline);
  const safeHtml = isHeadlineHtml && strippedHeadline ? sanitizeSurveyHtml(strippedHeadline) : "";

  return (
    <div className="text-heading mb-[3px] flex flex-col">
      {hasRequiredRule && (
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
        {/* No Tailwind size or weight utility here: those are `!important` inside a cascade layer,
            so they outranked the styling editor's headline size/weight on welcome, ending and Cal
            cards (M2.03). Like every question headline (survey-ui's Label: `label-headline
            leading-6`), this one takes its typography from `.label-headline` and the
            --fb-element-headline-* variables, which the editor and custom CSS on the headline hook
            both reach. The plain-text headline keeps its historical 600 weight as a non-important
            inline default: it beats the normal `.label-headline` rule, so unstyled surveys look as
            before, while the editor's and customers' `!important` values still win over it. */}
        {isHeadlineHtml ? (
          <HeadingTag
            data-testid="fb__surveys__headline-text-test"
            data-fb-part={FB_PART.headline}
            className="label-headline htmlbody leading-6"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <HeadingTag
            data-testid="fb__surveys__headline-text-test"
            data-fb-part={FB_PART.headline}
            className="label-headline leading-6"
            style={{ fontWeight: 600 }}>
            {headline}
          </HeadingTag>
        )}
      </div>
    </div>
  );
}
