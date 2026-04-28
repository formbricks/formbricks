import { TFunction } from "i18next";
import React from "react";
import {
  Column,
  Container,
  ElementHeader,
  Button as EmailButton,
  Img,
  Link,
  Row,
  Section,
  Tailwind,
  Text,
  render,
} from "@formbricks/email";
import {
  type TSurveyAddressElement,
  type TSurveyCTAElement,
  type TSurveyContactInfoElement,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
import { type TSurvey, type TSurveyStyling } from "@formbricks/types/surveys/types";
import { WEBAPP_URL } from "@/lib/constants";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { isLight, mixColor } from "@/lib/utils/colors";
import { parseRecallInfo } from "@/lib/utils/recall";
import { RatingSmiley } from "@/modules/analysis/components/RatingSmiley";
import { resolveStorageUrl } from "@/modules/storage/utils";
import { getNPSOptionColor, getRatingNumberOptionColor } from "../lib/utils";

interface PreviewEmailTemplateProps {
  survey: TSurvey;
  surveyUrl: string;
  styling: TSurveyStyling;
  locale: string;
  t: TFunction;
}

interface PreviewEmailStyleTokens {
  brandColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  fontFamily: string;
  inputColor: string;
  inputBorderColor: string;
  questionColor: string;
  roundness: number;
  signatureColor: string;
}

interface PreviewFieldConfig {
  id: string;
  label: string;
}

const EMAIL_PREVIEW_ACCENT_COLORS = {
  "bg-emerald-100": "#d1fae5",
  "bg-orange-100": "#ffedd5",
  "bg-rose-100": "#ffe4e6",
  "emerald-100": "#d1fae5",
  "orange-100": "#ffedd5",
  "rose-100": "#ffe4e6",
} as const;

const MULTI_CHOICE_MARKER = "\u2610";
const SINGLE_CHOICE_MARKER = "\u25EF";
const PREVIEW_LINK_TARGET = "_blank";
const SURVEY_EMAIL_FONT_FAMILY = "Inter, Helvetica, Arial, sans-serif";
const FORCE_LIGHT_COLOR_SCHEME = "only light";

const important = (value: string): string => `${value} !important`;

const getForcedBackgroundStyle = (color: string): React.CSSProperties => ({
  background: important(color),
  backgroundColor: important(color),
  colorScheme: FORCE_LIGHT_COLOR_SCHEME,
});

const getForcedColorStyle = (color: string): React.CSSProperties => ({
  color: important(color),
  colorScheme: FORCE_LIGHT_COLOR_SCHEME,
});

export const getPreviewEmailTemplateHtml = async (
  survey: TSurvey,
  surveyUrl: string,
  styling: TSurveyStyling,
  locale: string,
  t: TFunction
): Promise<string> => {
  return render(
    <PreviewEmailTemplate styling={styling} survey={survey} surveyUrl={surveyUrl} locale={locale} t={t} />,
    {
      pretty: true,
    }
  );
};

const getRatingContent = (scale: string, i: number, range: number, isColorCodingEnabled: boolean) => {
  if (scale === "smiley") {
    return (
      <RatingSmiley
        active={false}
        idx={i}
        range={range}
        addColors={isColorCodingEnabled}
        baseUrl={WEBAPP_URL}
      />
    );
  }
  if (scale === "number") {
    return (
      <Text
        style={{
          height: "46px",
          lineHeight: "46px",
          margin: 0,
          textAlign: "center",
        }}>
        {i + 1}
      </Text>
    );
  }
  if (scale === "star") {
    return (
      <Text
        style={{
          fontSize: "24px",
          lineHeight: "46px",
          margin: 0,
          textAlign: "center",
        }}>
        ⭐
      </Text>
    );
  }
  return null;
};

const getPreviewRoundness = (roundness: TSurveyStyling["roundness"]): number => {
  if (typeof roundness === "number") {
    return Number.isFinite(roundness) ? roundness : 8;
  }

  if (typeof roundness === "string") {
    const parsedRoundness = Number.parseFloat(roundness);
    return Number.isFinite(parsedRoundness) ? parsedRoundness : 8;
  }

  return 8;
};

const getPreviewEmailStyleTokens = (styling: TSurveyStyling): PreviewEmailStyleTokens => {
  const questionColor = styling.questionColor?.light ?? COLOR_DEFAULTS.questionColor;
  const signatureColor = isLight(questionColor)
    ? mixColor(questionColor, "#000000", 0.2)
    : mixColor(questionColor, "#ffffff", 0.2);

  return {
    brandColor: styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
    cardBackgroundColor: styling.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor,
    cardBorderColor: styling.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor,
    fontFamily: styling.fontFamily ?? SURVEY_EMAIL_FONT_FAMILY,
    inputColor: styling.inputColor?.light ?? COLOR_DEFAULTS.inputColor,
    inputBorderColor: styling.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor,
    questionColor,
    roundness: getPreviewRoundness(styling.roundness),
    signatureColor,
  };
};

const buildSurveyEmailUrl = (surveyUrl: string, entries: Array<[string, string]>): string => {
  const url = new URL(surveyUrl);

  for (const [key, value] of entries) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

const getPreviewSurveyUrl = (surveyUrl: string): string =>
  buildSurveyEmailUrl(surveyUrl, [["preview", "true"]]);

const getPrefilledSurveyUrl = (surveyUrl: string, questionId: string, value: string): string =>
  buildSurveyEmailUrl(surveyUrl, [
    ["preview", "true"],
    [questionId, value],
    ["skipPrefilled", "true"],
  ]);

const getChoiceBlockStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedBackgroundStyle(styleTokens.inputColor),
  border: important(`1px solid ${styleTokens.inputBorderColor}`),
  borderRadius: `${styleTokens.roundness}px`,
});

const getChoiceTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  display: "block",
  fontFamily: styleTokens.fontFamily,
  fontSize: "16px",
  fontWeight: 400,
  lineHeight: "24px",
  margin: 0,
  padding: "16px",
  textDecoration: "none",
});

const getChoiceCardStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getChoiceBlockStyle(styleTokens),
  ...getChoiceTextStyle(styleTokens),
});

const getChoiceMarkerStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  display: "inline-block",
  fontFamily: styleTokens.fontFamily,
  minWidth: "20px",
});

const getSecondaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  border: important(`1px solid ${styleTokens.inputBorderColor}`),
  borderRadius: `${styleTokens.roundness}px`,
  ...getForcedColorStyle(styleTokens.questionColor),
  display: "inline-block",
  fontFamily: styleTokens.fontFamily,
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: "20px",
  padding: "12px 24px",
  textDecoration: "none",
});

const getPrimaryButtonStyle = (
  styleTokens: PreviewEmailStyleTokens,
  brandColor: string
): React.CSSProperties => ({
  ...getSecondaryButtonStyle(styleTokens),
  ...getForcedBackgroundStyle(brandColor),
  border: important(`1px solid ${brandColor}`),
  ...getForcedColorStyle(isLight(brandColor) ? "#000000" : "#ffffff"),
});

const getPreviewAccentColor = (token?: string): string | undefined =>
  token ? EMAIL_PREVIEW_ACCENT_COLORS[token as keyof typeof EMAIL_PREVIEW_ACCENT_COLORS] : undefined;

const getScaleOptionStyle = ({
  styleTokens,
  borderTopColor,
  isCompact = false,
  isTransparent = false,
}: {
  styleTokens: PreviewEmailStyleTokens;
  borderTopColor?: string;
  isCompact?: boolean;
  isTransparent?: boolean;
}): React.CSSProperties => ({
  ...getForcedBackgroundStyle(isTransparent ? "transparent" : styleTokens.inputColor),
  border: important(isTransparent ? "1px solid transparent" : `1px solid ${styleTokens.inputBorderColor}`),
  borderRadius: `${styleTokens.roundness}px`,
  ...getForcedColorStyle(styleTokens.questionColor),
  display: "block",
  fontFamily: styleTokens.fontFamily,
  fontSize: "14px",
  fontWeight: 500,
  height: isCompact ? "40px" : "46px",
  lineHeight: isCompact ? "40px" : "46px",
  padding: 0,
  textAlign: "center",
  textDecoration: "none",
  width: "100%",
  ...(borderTopColor ? { borderTop: important(`6px solid ${borderTopColor}`) } : {}),
});

const getLightModeTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
});

const getHelperLabelTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getLightModeTextStyle(styleTokens),
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
});

const getCenteredPlaceholderStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getChoiceBlockStyle(styleTokens),
    marginTop: "16px",
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const getCenteredPlaceholderTextStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getChoiceTextStyle(styleTokens),
    padding: "12px 16px",
    textAlign: "center",
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const renderChoiceLabel = (
  marker: string,
  label: string,
  styleTokens: PreviewEmailStyleTokens
): React.JSX.Element => (
  <>
    <span style={getChoiceMarkerStyle(styleTokens)}>{marker}</span>
    <span>{label}</span>
  </>
);

function PreviewElementHeader({
  headline,
  subheader,
  className,
  styleTokens,
}: Readonly<{
  headline: string;
  subheader?: string;
  className?: string;
  styleTokens: PreviewEmailStyleTokens;
}>): React.JSX.Element {
  return (
    <ElementHeader
      className={className}
      headline={headline}
      style={getLightModeTextStyle(styleTokens)}
      subheader={subheader}
    />
  );
}

const getConfiguredPreviewFields = (
  fields: Array<{
    id: string;
    show: boolean;
    placeholder: Parameters<typeof getLocalizedValue>[0];
    fallback: string;
  }>,
  defaultLanguageCode: string
): PreviewFieldConfig[] =>
  fields
    .filter((field) => field.show)
    .map((field) => ({
      id: field.id,
      label: getLocalizedValue(field.placeholder, defaultLanguageCode) || field.fallback,
    }));

const getAddressPreviewFields = (
  element: TSurveyAddressElement,
  defaultLanguageCode: string
): PreviewFieldConfig[] =>
  getConfiguredPreviewFields(
    [
      {
        id: "addressLine1",
        show: element.addressLine1.show,
        placeholder: element.addressLine1.placeholder,
        fallback: "Address line 1",
      },
      {
        id: "addressLine2",
        show: element.addressLine2.show,
        placeholder: element.addressLine2.placeholder,
        fallback: "Address line 2",
      },
      {
        id: "city",
        show: element.city.show,
        placeholder: element.city.placeholder,
        fallback: "City",
      },
      {
        id: "state",
        show: element.state.show,
        placeholder: element.state.placeholder,
        fallback: "State",
      },
      {
        id: "zip",
        show: element.zip.show,
        placeholder: element.zip.placeholder,
        fallback: "ZIP code",
      },
      {
        id: "country",
        show: element.country.show,
        placeholder: element.country.placeholder,
        fallback: "Country",
      },
    ],
    defaultLanguageCode
  );

const getContactPreviewFields = (
  element: TSurveyContactInfoElement,
  defaultLanguageCode: string
): PreviewFieldConfig[] =>
  getConfiguredPreviewFields(
    [
      {
        id: "firstName",
        show: element.firstName.show,
        placeholder: element.firstName.placeholder,
        fallback: "First name",
      },
      {
        id: "lastName",
        show: element.lastName.show,
        placeholder: element.lastName.placeholder,
        fallback: "Last name",
      },
      {
        id: "email",
        show: element.email.show,
        placeholder: element.email.placeholder,
        fallback: "Email",
      },
      {
        id: "phone",
        show: element.phone.show,
        placeholder: element.phone.placeholder,
        fallback: "Phone",
      },
      {
        id: "company",
        show: element.company.show,
        placeholder: element.company.placeholder,
        fallback: "Company",
      },
    ],
    defaultLanguageCode
  );

export async function PreviewEmailTemplate({
  survey,
  surveyUrl,
  styling,
  locale,
  t,
}: PreviewEmailTemplateProps): Promise<React.JSX.Element> {
  const previewSurveyUrl = getPreviewSurveyUrl(surveyUrl);
  const defaultLanguageCode = "default";

  const questions = getElementsFromBlocks(survey.blocks);
  const firstQuestion = questions[0];

  const headline = parseRecallInfo(
    getLocalizedValue(firstQuestion.headline, defaultLanguageCode),
    undefined,
    undefined,
    false,
    locale
  );
  const subheader = parseRecallInfo(
    getLocalizedValue(firstQuestion.subheader, defaultLanguageCode),
    undefined,
    undefined,
    false,
    locale
  );
  const styleTokens = getPreviewEmailStyleTokens(styling);
  const brandColor = styleTokens.brandColor;

  switch (firstQuestion.type) {
    case TSurveyElementTypeEnum.OpenText: {
      const openTextPlaceholder = firstQuestion.placeholder
        ? getLocalizedValue(firstQuestion.placeholder, defaultLanguageCode)
        : "";

      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Section style={{ width: "100%" }}>
            <Link
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens, {
                ...getForcedBackgroundStyle("#f8fafc"),
                display: "block",
                minHeight: "80px",
                textDecoration: "none",
              })}
              target={PREVIEW_LINK_TARGET}>
              <Text
                style={getCenteredPlaceholderTextStyle(styleTokens, {
                  ...getForcedColorStyle("#94a3b8"),
                  padding: "28px 16px",
                  textAlign: "left",
                })}>
                {openTextPlaceholder || "\u00A0"}
              </Text>
            </Link>
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    }
    case TSurveyElementTypeEnum.Consent:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Container
            bgcolor={styleTokens.inputColor}
            style={{
              ...getChoiceBlockStyle(styleTokens),
              margin: "16px 0 0",
              maxWidth: "none",
              padding: "16px",
              width: "100%",
            }}>
            <Text
              style={{
                ...getForcedColorStyle(styleTokens.questionColor),
                fontFamily: styleTokens.fontFamily,
                fontSize: "16px",
                fontWeight: 500,
                lineHeight: "24px",
                margin: 0,
              }}>
              {getLocalizedValue(firstQuestion.label, defaultLanguageCode)}
            </Text>
          </Container>
          <Section style={{ marginTop: "16px", textAlign: "right" }}>
            {!firstQuestion.required && (
              <EmailButton
                style={getSecondaryButtonStyle(styleTokens)}
                href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, "dismissed")}
                target={PREVIEW_LINK_TARGET}>
                {t("emails.reject")}
              </EmailButton>
            )}
            <EmailButton
              style={{
                ...getPrimaryButtonStyle(styleTokens, brandColor),
                marginLeft: firstQuestion.required ? 0 : "8px",
              }}
              href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, "accepted")}
              target={PREVIEW_LINK_TARGET}>
              {t("emails.accept")}
            </EmailButton>
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.NPS:
      return (
        <EmailTemplateWrapper styling={styling}>
          <Section style={{ width: "100%" }}>
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Container style={{ margin: "16px 0 0", maxWidth: "none", width: "100%" }}>
              <Section style={{ width: "100%" }}>
                <Row>
                  {Array.from({ length: 11 }, (_, i) => (
                    <Column
                      key={i}
                      style={{
                        paddingLeft: i === 0 ? "0" : "4px",
                        width: `${(100 / 11).toFixed(4)}%`,
                      }}>
                      <EmailButton
                        href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, i.toString())}
                        style={getScaleOptionStyle({
                          styleTokens,
                          borderTopColor:
                            firstQuestion.isColorCodingEnabled && firstQuestion.scale === "number"
                              ? getPreviewAccentColor(getNPSOptionColor(i + 1))
                              : undefined,
                          isCompact: firstQuestion.scale !== "number",
                        })}
                        target={PREVIEW_LINK_TARGET}>
                        {i}
                      </EmailButton>
                    </Column>
                  ))}
                </Row>
              </Section>
              <Section style={{ marginTop: "8px", width: "100%" }}>
                <Row>
                  <Column>
                    <Text style={getHelperLabelTextStyle(styleTokens)}>
                      {getLocalizedValue(firstQuestion.lowerLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                  <Column style={{ textAlign: "right" }}>
                    <Text
                      style={{
                        ...getHelperLabelTextStyle(styleTokens),
                        textAlign: "right",
                      }}>
                      {getLocalizedValue(firstQuestion.upperLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Container>
            <EmailFooter
              fontFamily={styleTokens.fontFamily}
              signatureColor={styleTokens.signatureColor}
              t={t}
            />
          </Section>
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.CTA: {
      const ctaElement = firstQuestion as TSurveyCTAElement;
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          {ctaElement.buttonExternal && ctaElement.ctaButtonLabel && ctaElement.buttonUrl && (
            <Section style={{ marginTop: "16px", textAlign: "right" }}>
              <EmailButton
                style={getSecondaryButtonStyle(styleTokens)}
                href={ctaElement.buttonUrl}
                target={PREVIEW_LINK_TARGET}>
                {getLocalizedValue(ctaElement.ctaButtonLabel, defaultLanguageCode)} {"↗"}
              </EmailButton>
            </Section>
          )}
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    }
    case TSurveyElementTypeEnum.Rating:
      return (
        <EmailTemplateWrapper styling={styling}>
          <Section style={{ width: "100%" }}>
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Container style={{ margin: "16px 0 0", maxWidth: "none", width: "100%" }}>
              <Section style={{ width: "100%" }}>
                <Row>
                  {Array.from({ length: firstQuestion.range }, (_, i) => (
                    <Column
                      key={i}
                      style={{
                        paddingLeft: i === 0 ? "0" : "4px",
                        width: `${(100 / firstQuestion.range).toFixed(4)}%`,
                      }}>
                      <EmailButton
                        style={getScaleOptionStyle({
                          styleTokens,
                          borderTopColor:
                            firstQuestion.isColorCodingEnabled && firstQuestion.scale === "number"
                              ? getPreviewAccentColor(getRatingNumberOptionColor(firstQuestion.range, i + 1))
                              : undefined,
                          isTransparent: firstQuestion.scale === "star",
                        })}
                        href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, (i + 1).toString())}
                        target={PREVIEW_LINK_TARGET}>
                        {getRatingContent(
                          firstQuestion.scale,
                          i,
                          firstQuestion.range,
                          firstQuestion.isColorCodingEnabled
                        )}
                      </EmailButton>
                    </Column>
                  ))}
                </Row>
              </Section>
              <Section style={{ marginTop: "8px", width: "100%" }}>
                <Row>
                  <Column>
                    <Text style={getHelperLabelTextStyle(styleTokens)}>
                      {getLocalizedValue(firstQuestion.lowerLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                  <Column style={{ textAlign: "right" }}>
                    <Text
                      style={{
                        ...getHelperLabelTextStyle(styleTokens),
                        textAlign: "right",
                      }}>
                      {getLocalizedValue(firstQuestion.upperLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Container>
            <EmailFooter
              fontFamily={styleTokens.fontFamily}
              signatureColor={styleTokens.signatureColor}
              t={t}
            />
          </Section>
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section key={choice.id} style={{ marginTop: "8px", width: "100%" }}>
                <Link
                  href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choice.id)}
                  style={getChoiceCardStyle(styleTokens)}
                  target={PREVIEW_LINK_TARGET}>
                  {renderChoiceLabel(
                    MULTI_CHOICE_MARKER,
                    getLocalizedValue(choice.label, defaultLanguageCode),
                    styleTokens
                  )}
                </Link>
              </Section>
            ))}
          </Container>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.Ranking:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section key={choice.id} style={{ marginTop: "8px", width: "100%" }}>
                <Link
                  href={previewSurveyUrl}
                  style={getChoiceCardStyle(styleTokens)}
                  target={PREVIEW_LINK_TARGET}>
                  {getLocalizedValue(choice.label, defaultLanguageCode)}
                </Link>
              </Section>
            ))}
          </Container>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section key={choice.id} style={{ marginTop: "8px", width: "100%" }}>
                <Link
                  href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choice.id)}
                  style={getChoiceCardStyle(styleTokens)}
                  target={PREVIEW_LINK_TARGET}>
                  {renderChoiceLabel(
                    SINGLE_CHOICE_MARKER,
                    getLocalizedValue(choice.label, defaultLanguageCode),
                    styleTokens
                  )}
                </Link>
              </Section>
            ))}
          </Container>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.PictureSelection:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Section className="mx-0 mt-4">
            {firstQuestion.choices.map((choice) => (
              <Link
                className="rounded-custom mb-3 mr-3 inline-block h-[150px] w-[250px]"
                href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choice.id)}
                key={choice.id}
                target={PREVIEW_LINK_TARGET}>
                <Img className="rounded-custom h-full w-full" src={resolveStorageUrl(choice.imageUrl)} />
              </Link>
            ))}
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.Cal:
      return (
        <EmailTemplateWrapper styling={styling}>
          <Container>
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Section style={{ marginTop: "16px", textAlign: "center" }}>
              <EmailButton
                href={previewSurveyUrl}
                style={getPrimaryButtonStyle(styleTokens, brandColor)}
                target={PREVIEW_LINK_TARGET}>
                {t("emails.schedule_your_meeting")}
              </EmailButton>
            </Section>
          </Container>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.Date:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Section style={{ width: "100%" }}>
            <Link
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens, {
                display: "block",
                textDecoration: "none",
              })}
              target={PREVIEW_LINK_TARGET}>
              <Text
                style={getCenteredPlaceholderTextStyle(styleTokens, {
                  fontSize: "14px",
                })}>
                {t("emails.select_a_date")}
              </Text>
            </Link>
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.Matrix:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Container className="mx-0">
            <Section className="w-full table-auto">
              <Row>
                <Column className="w-40 break-words px-4 py-2" />
                {firstQuestion.columns.map((column) => {
                  return (
                    <Column
                      className="text-question-color max-w-40 break-words px-4 py-2 text-center"
                      key={column.id}
                      style={{ ...getLightModeTextStyle(styleTokens), textAlign: "center" }}>
                      {getLocalizedValue(column.label, "default")}
                    </Column>
                  );
                })}
              </Row>
              {firstQuestion.rows.map((row, rowIndex) => {
                return (
                  <Row
                    className={`${rowIndex % 2 === 0 ? "bg-input-color" : ""} rounded-custom`}
                    key={row.id}
                    style={
                      rowIndex % 2 === 0
                        ? {
                            ...getForcedBackgroundStyle(styleTokens.inputColor),
                          }
                        : undefined
                    }>
                    <Column className="w-40 break-words px-4 py-2" style={getLightModeTextStyle(styleTokens)}>
                      {getLocalizedValue(row.label, "default")}
                    </Column>
                    {firstQuestion.columns.map((column) => {
                      return (
                        <Column
                          className="text-question-color px-4 py-2"
                          key={column.id}
                          style={getLightModeTextStyle(styleTokens)}>
                          <Section
                            className="bg-card-bg-color h-4 w-4 rounded-full p-2 outline"
                            style={{
                              ...getForcedBackgroundStyle(styleTokens.cardBackgroundColor),
                            }}
                          />
                        </Column>
                      );
                    })}
                  </Row>
                );
              })}
            </Section>
          </Container>
          <Section style={{ marginTop: "16px", textAlign: "right" }}>
            <EmailButton
              href={previewSurveyUrl}
              style={getSecondaryButtonStyle(styleTokens)}
              target={PREVIEW_LINK_TARGET}>
              {t("common.continue")}
            </EmailButton>
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    case TSurveyElementTypeEnum.Address: {
      const addressFields = getAddressPreviewFields(firstQuestion, defaultLanguageCode);

      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          {addressFields.map((field) => (
            <Section key={field.id} style={{ marginTop: "16px", width: "100%" }}>
              <Link
                href={previewSurveyUrl}
                style={{
                  ...getChoiceBlockStyle(styleTokens),
                  ...getForcedColorStyle("#94a3b8"),
                  display: "block",
                  fontFamily: styleTokens.fontFamily,
                  fontSize: "14px",
                  lineHeight: "20px",
                  padding: "10px 12px",
                  textDecoration: "none",
                  width: "100%",
                }}
                target={PREVIEW_LINK_TARGET}>
                {field.label}
              </Link>
            </Section>
          ))}
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    }
    case TSurveyElementTypeEnum.ContactInfo: {
      const contactFields = getContactPreviewFields(firstQuestion, defaultLanguageCode);

      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          {contactFields.map((field) => (
            <Section key={field.id} style={{ marginTop: "16px", width: "100%" }}>
              <Link
                href={previewSurveyUrl}
                style={{
                  ...getChoiceBlockStyle(styleTokens),
                  ...getForcedColorStyle("#94a3b8"),
                  display: "block",
                  fontFamily: styleTokens.fontFamily,
                  fontSize: "14px",
                  lineHeight: "20px",
                  padding: "10px 12px",
                  textDecoration: "none",
                  width: "100%",
                }}
                target={PREVIEW_LINK_TARGET}>
                {field.label}
              </Link>
            </Section>
          ))}
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
    }
    case TSurveyElementTypeEnum.FileUpload:
      return (
        <EmailTemplateWrapper styling={styling}>
          <PreviewElementHeader
            headline={headline}
            subheader={subheader}
            className="mr-8"
            styleTokens={styleTokens}
          />
          <Section style={{ width: "100%" }}>
            <Link
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens, {
                ...getForcedBackgroundStyle("#f8fafc"),
                border: important(`1px dashed ${styleTokens.inputBorderColor}`),
                display: "block",
                minHeight: "96px",
                textDecoration: "none",
              })}
              target={PREVIEW_LINK_TARGET}>
              <Text
                style={getCenteredPlaceholderTextStyle(styleTokens, {
                  ...getForcedColorStyle("#64748b"),
                  fontSize: "14px",
                  lineHeight: "24px",
                })}>
                {t("emails.click_or_drag_to_upload_files")}
              </Text>
            </Link>
          </Section>
          <EmailFooter
            fontFamily={styleTokens.fontFamily}
            signatureColor={styleTokens.signatureColor}
            t={t}
          />
        </EmailTemplateWrapper>
      );
  }
}

function EmailTemplateWrapper({
  children,
  styling,
}: Readonly<{
  children: React.ReactNode;
  styling: TSurveyStyling;
}>): React.JSX.Element {
  const styleTokens = getPreviewEmailStyleTokens(styling);
  const colors = {
    "brand-color": styleTokens.brandColor,
    "card-bg-color": styleTokens.cardBackgroundColor,
    "input-color": styleTokens.inputColor,
    "input-border-color": styleTokens.inputBorderColor,
    "card-border-color": styleTokens.cardBorderColor,
    "question-color": styleTokens.questionColor,
    "signature-color": styleTokens.signatureColor,
  };

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors,
            borderRadius: {
              custom: `${styleTokens.roundness.toString()}px`,
            },
          },
        },
      }}>
      <Section
        bgcolor={styleTokens.cardBackgroundColor}
        className="bg-card-bg-color border-card-border-color rounded-custom mx-0 my-2 border border-solid p-8 text-inherit"
        style={{
          ...getForcedBackgroundStyle(styleTokens.cardBackgroundColor),
          border: important(`1px solid ${styleTokens.cardBorderColor}`),
          borderRadius: `${styleTokens.roundness}px`,
          ...getForcedColorStyle(styleTokens.questionColor),
          fontFamily: styleTokens.fontFamily,
          margin: "8px 0",
          padding: "32px",
          width: "100%",
        }}>
        {children}
      </Section>
    </Tailwind>
  );
}

function EmailFooter({
  fontFamily,
  signatureColor,
  t,
}: Readonly<{ fontFamily: string; signatureColor: string; t: TFunction }>): React.JSX.Element {
  return (
    <Container className="m-auto mt-8 text-center" style={{ margin: "32px auto 0", textAlign: "center" }}>
      <Link
        className="text-signature-color text-xs"
        href="https://formbricks.com?utm_source=email_branding"
        style={{ ...getForcedColorStyle(signatureColor), fontFamily, fontSize: "12px" }}
        target={PREVIEW_LINK_TARGET}>
        {t("common.powered_by_formbricks")}
      </Link>
    </Container>
  );
}
