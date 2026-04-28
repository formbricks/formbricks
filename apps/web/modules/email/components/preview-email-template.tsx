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
  readonly id: string;
  readonly label: string;
}

interface PreviewChoiceConfig {
  readonly id: string;
  readonly label: Parameters<typeof getLocalizedValue>[0];
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
const CHOICE_LINK_CLASSNAME = "block p-4 text-base font-normal leading-6 no-underline";
const FIELD_LINK_CLASSNAME = "block w-full px-3 py-2.5 text-sm leading-5 no-underline";
const SECONDARY_BUTTON_CLASSNAME = "inline-block px-6 py-3 text-sm font-medium leading-5 no-underline";
const SCALE_BUTTON_CLASSNAME = "block w-full p-0 text-center text-sm font-medium no-underline";

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
  fontFamily: styleTokens.fontFamily,
});

const getChoiceCardStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getChoiceBlockStyle(styleTokens),
  ...getChoiceTextStyle(styleTokens),
});

const getFieldPlaceholderStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getChoiceBlockStyle(styleTokens),
  ...getForcedColorStyle("#94a3b8"),
  fontFamily: styleTokens.fontFamily,
});

const getChoiceMarkerStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
});

const getSecondaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  border: important(`1px solid ${styleTokens.inputBorderColor}`),
  borderRadius: `${styleTokens.roundness}px`,
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
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
  fontFamily: styleTokens.fontFamily,
  height: isCompact ? "40px" : "46px",
  lineHeight: isCompact ? "40px" : "46px",
  ...(borderTopColor ? { borderTop: important(`6px solid ${borderTopColor}`) } : {}),
});

const getLightModeTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
});

const getHelperLabelTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getLightModeTextStyle(styleTokens),
});

const getCenteredPlaceholderStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getChoiceBlockStyle(styleTokens),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const getCenteredPlaceholderTextStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getChoiceTextStyle(styleTokens),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const getScaleColumnStyle = (optionIndex: number, optionCount: number): React.CSSProperties => ({
  paddingLeft: optionIndex === 0 ? "0" : "4px",
  width: `${(100 / optionCount).toFixed(4)}%`,
});

const renderChoiceLabel = (
  marker: string,
  label: string,
  styleTokens: PreviewEmailStyleTokens
): React.JSX.Element => (
  <>
    <span className="inline-block min-w-5" style={getChoiceMarkerStyle(styleTokens)}>
      {marker}
    </span>
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
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Section className="w-full">
            <Link
              className="mt-4 block min-h-20 no-underline"
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens, {
                ...getForcedBackgroundStyle("#f8fafc"),
              })}
              target={PREVIEW_LINK_TARGET}>
              <Text
                className="m-0 px-4 py-7 text-left text-base font-normal leading-6"
                style={getCenteredPlaceholderTextStyle(styleTokens, {
                  ...getForcedColorStyle("#94a3b8"),
                })}>
                {openTextPlaceholder || "\u00A0"}
              </Text>
            </Link>
          </Section>
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.Consent:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Container
            className="m-0 mt-4 w-full max-w-none p-4"
            bgcolor={styleTokens.inputColor}
            style={{
              ...getChoiceBlockStyle(styleTokens),
            }}>
            <Text
              className="m-0 text-base font-medium leading-6"
              style={{
                ...getForcedColorStyle(styleTokens.questionColor),
                fontFamily: styleTokens.fontFamily,
              }}>
              {getLocalizedValue(firstQuestion.label, defaultLanguageCode)}
            </Text>
          </Container>
          <Section className="mt-4 text-right">
            {!firstQuestion.required && (
              <EmailButton
                className={SECONDARY_BUTTON_CLASSNAME}
                style={getSecondaryButtonStyle(styleTokens)}
                href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, "dismissed")}
                target={PREVIEW_LINK_TARGET}>
                {t("emails.reject")}
              </EmailButton>
            )}
            <EmailButton
              className={SECONDARY_BUTTON_CLASSNAME}
              style={{
                ...getPrimaryButtonStyle(styleTokens, brandColor),
                marginLeft: firstQuestion.required ? 0 : "8px",
              }}
              href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, "accepted")}
              target={PREVIEW_LINK_TARGET}>
              {t("emails.accept")}
            </EmailButton>
          </Section>
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.NPS:
      return (
        <PreviewEmailCard styleTokens={styleTokens} t={t}>
          <Section className="w-full">
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Container className="mx-0 mt-4 w-full max-w-none">
              <Section className="w-full">
                <Row>
                  {Array.from({ length: 11 }, (_, i) => (
                    <PreviewScaleOptionColumn
                      key={i}
                      href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, i.toString())}
                      optionCount={11}
                      optionIndex={i}
                      optionStyle={getScaleOptionStyle({
                        styleTokens,
                        borderTopColor:
                          firstQuestion.isColorCodingEnabled && firstQuestion.scale === "number"
                            ? getPreviewAccentColor(getNPSOptionColor(i + 1))
                            : undefined,
                        isCompact: firstQuestion.scale !== "number",
                      })}>
                      {i}
                    </PreviewScaleOptionColumn>
                  ))}
                </Row>
              </Section>
              <PreviewScaleLabels
                defaultLanguageCode={defaultLanguageCode}
                lowerLabel={firstQuestion.lowerLabel}
                styleTokens={styleTokens}
                upperLabel={firstQuestion.upperLabel}
              />
            </Container>
          </Section>
        </PreviewEmailCard>
      );
    case TSurveyElementTypeEnum.CTA: {
      const ctaElement = firstQuestion as TSurveyCTAElement;
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          {ctaElement.buttonExternal && ctaElement.ctaButtonLabel && ctaElement.buttonUrl && (
            <Section className="mt-4 text-right">
              <EmailButton
                className={SECONDARY_BUTTON_CLASSNAME}
                style={getSecondaryButtonStyle(styleTokens)}
                href={ctaElement.buttonUrl}
                target={PREVIEW_LINK_TARGET}>
                {getLocalizedValue(ctaElement.ctaButtonLabel, defaultLanguageCode)} {"↗"}
              </EmailButton>
            </Section>
          )}
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.Rating:
      return (
        <PreviewEmailCard styleTokens={styleTokens} t={t}>
          <Section className="w-full">
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Container className="mx-0 mt-4 w-full max-w-none">
              <Section className="w-full">
                <Row>
                  {Array.from({ length: firstQuestion.range }, (_, i) => (
                    <PreviewScaleOptionColumn
                      key={i}
                      href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, (i + 1).toString())}
                      optionCount={firstQuestion.range}
                      optionIndex={i}
                      optionStyle={getScaleOptionStyle({
                        styleTokens,
                        borderTopColor:
                          firstQuestion.isColorCodingEnabled && firstQuestion.scale === "number"
                            ? getPreviewAccentColor(getRatingNumberOptionColor(firstQuestion.range, i + 1))
                            : undefined,
                        isTransparent: firstQuestion.scale === "star",
                      })}>
                      {getRatingContent(
                        firstQuestion.scale,
                        i,
                        firstQuestion.range,
                        firstQuestion.isColorCodingEnabled
                      )}
                    </PreviewScaleOptionColumn>
                  ))}
                </Row>
              </Section>
              <PreviewScaleLabels
                defaultLanguageCode={defaultLanguageCode}
                lowerLabel={firstQuestion.lowerLabel}
                styleTokens={styleTokens}
                upperLabel={firstQuestion.upperLabel}
              />
            </Container>
          </Section>
        </PreviewEmailCard>
      );
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewChoiceList
            choices={firstQuestion.choices}
            defaultLanguageCode={defaultLanguageCode}
            getHref={(choiceId) => getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choiceId)}
            marker={MULTI_CHOICE_MARKER}
            styleTokens={styleTokens}
          />
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.Ranking:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewChoiceList
            choices={firstQuestion.choices}
            defaultLanguageCode={defaultLanguageCode}
            getHref={() => previewSurveyUrl}
            styleTokens={styleTokens}
          />
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewChoiceList
            choices={firstQuestion.choices}
            defaultLanguageCode={defaultLanguageCode}
            getHref={(choiceId) => getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choiceId)}
            marker={SINGLE_CHOICE_MARKER}
            styleTokens={styleTokens}
          />
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.PictureSelection:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
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
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.Cal:
      return (
        <PreviewEmailCard styleTokens={styleTokens} t={t}>
          <Container>
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Section className="mt-4 text-center">
              <EmailButton
                className={SECONDARY_BUTTON_CLASSNAME}
                href={previewSurveyUrl}
                style={getPrimaryButtonStyle(styleTokens, brandColor)}
                target={PREVIEW_LINK_TARGET}>
                {t("emails.schedule_your_meeting")}
              </EmailButton>
            </Section>
          </Container>
        </PreviewEmailCard>
      );
    case TSurveyElementTypeEnum.Date:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Section className="w-full">
            <Link
              className="mt-4 block no-underline"
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens)}
              target={PREVIEW_LINK_TARGET}>
              <Text
                className="m-0 px-4 py-3 text-center text-sm leading-6"
                style={getCenteredPlaceholderTextStyle(styleTokens)}>
                {t("emails.select_a_date")}
              </Text>
            </Link>
          </Section>
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.Matrix:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
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
          <Section className="mt-4 text-right">
            <EmailButton
              className={SECONDARY_BUTTON_CLASSNAME}
              href={previewSurveyUrl}
              style={getSecondaryButtonStyle(styleTokens)}
              target={PREVIEW_LINK_TARGET}>
              {t("common.continue")}
            </EmailButton>
          </Section>
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.Address: {
      const addressFields = getAddressPreviewFields(firstQuestion, defaultLanguageCode);

      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewFieldList fields={addressFields} href={previewSurveyUrl} styleTokens={styleTokens} />
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.ContactInfo: {
      const contactFields = getContactPreviewFields(firstQuestion, defaultLanguageCode);

      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewFieldList fields={contactFields} href={previewSurveyUrl} styleTokens={styleTokens} />
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.FileUpload:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Section className="w-full">
            <Link
              className="mt-4 block min-h-24 no-underline"
              href={previewSurveyUrl}
              style={getCenteredPlaceholderStyle(styleTokens, {
                ...getForcedBackgroundStyle("#f8fafc"),
                border: important(`1px dashed ${styleTokens.inputBorderColor}`),
              })}
              target={PREVIEW_LINK_TARGET}>
              <Text
                className="m-0 px-4 py-3 text-center text-sm leading-6"
                style={getCenteredPlaceholderTextStyle(styleTokens, {
                  ...getForcedColorStyle("#64748b"),
                })}>
                {t("emails.click_or_drag_to_upload_files")}
              </Text>
            </Link>
          </Section>
        </PreviewQuestionCard>
      );
  }
}

function PreviewQuestionCard({
  children,
  headline,
  styleTokens,
  subheader,
  t,
}: Readonly<{
  children: React.ReactNode;
  headline: string;
  styleTokens: PreviewEmailStyleTokens;
  subheader?: string;
  t: TFunction;
}>): React.JSX.Element {
  return (
    <PreviewEmailCard styleTokens={styleTokens} t={t}>
      <PreviewElementHeader
        className="mr-8"
        headline={headline}
        styleTokens={styleTokens}
        subheader={subheader}
      />
      {children}
    </PreviewEmailCard>
  );
}

function PreviewEmailCard({
  children,
  styleTokens,
  t,
}: Readonly<{
  children: React.ReactNode;
  styleTokens: PreviewEmailStyleTokens;
  t: TFunction;
}>): React.JSX.Element {
  return (
    <EmailTemplateWrapper styleTokens={styleTokens}>
      {children}
      <EmailFooter fontFamily={styleTokens.fontFamily} signatureColor={styleTokens.signatureColor} t={t} />
    </EmailTemplateWrapper>
  );
}

function PreviewChoiceList({
  choices,
  defaultLanguageCode,
  getHref,
  marker,
  styleTokens,
}: Readonly<{
  choices: ReadonlyArray<PreviewChoiceConfig>;
  defaultLanguageCode: string;
  getHref: (choiceId: string) => string;
  marker?: string;
  styleTokens: PreviewEmailStyleTokens;
}>): React.JSX.Element {
  return (
    <Container className="mx-0 max-w-none">
      {choices.map((choice) => {
        const label = getLocalizedValue(choice.label, defaultLanguageCode);

        return (
          <Section className="mt-2 w-full" key={choice.id}>
            <Link
              className={CHOICE_LINK_CLASSNAME}
              href={getHref(choice.id)}
              style={getChoiceCardStyle(styleTokens)}
              target={PREVIEW_LINK_TARGET}>
              {marker ? renderChoiceLabel(marker, label, styleTokens) : label}
            </Link>
          </Section>
        );
      })}
    </Container>
  );
}

function PreviewFieldList({
  fields,
  href,
  styleTokens,
}: Readonly<{
  fields: ReadonlyArray<PreviewFieldConfig>;
  href: string;
  styleTokens: PreviewEmailStyleTokens;
}>): React.JSX.Element {
  return (
    <>
      {fields.map((field) => (
        <Section className="mt-4 w-full" key={field.id}>
          <Link
            className={FIELD_LINK_CLASSNAME}
            href={href}
            style={getFieldPlaceholderStyle(styleTokens)}
            target={PREVIEW_LINK_TARGET}>
            {field.label}
          </Link>
        </Section>
      ))}
    </>
  );
}

function PreviewScaleOptionColumn({
  children,
  href,
  optionCount,
  optionIndex,
  optionStyle,
}: Readonly<{
  children: React.ReactNode;
  href: string;
  optionCount: number;
  optionIndex: number;
  optionStyle: React.CSSProperties;
}>): React.JSX.Element {
  return (
    <Column style={getScaleColumnStyle(optionIndex, optionCount)}>
      <EmailButton
        className={SCALE_BUTTON_CLASSNAME}
        href={href}
        style={optionStyle}
        target={PREVIEW_LINK_TARGET}>
        {children}
      </EmailButton>
    </Column>
  );
}

function PreviewScaleLabels({
  defaultLanguageCode,
  lowerLabel,
  styleTokens,
  upperLabel,
}: Readonly<{
  defaultLanguageCode: string;
  lowerLabel: Parameters<typeof getLocalizedValue>[0];
  styleTokens: PreviewEmailStyleTokens;
  upperLabel: Parameters<typeof getLocalizedValue>[0];
}>): React.JSX.Element {
  return (
    <Section className="mt-2 w-full">
      <Row>
        <Column>
          <Text className="m-0 text-xs leading-[18px]" style={getHelperLabelTextStyle(styleTokens)}>
            {getLocalizedValue(lowerLabel, defaultLanguageCode)}
          </Text>
        </Column>
        <Column style={{ textAlign: "right" }}>
          <Text
            className="m-0 text-xs leading-[18px]"
            style={{
              ...getHelperLabelTextStyle(styleTokens),
              textAlign: "right",
            }}>
            {getLocalizedValue(upperLabel, defaultLanguageCode)}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

function EmailTemplateWrapper({
  children,
  styleTokens,
}: Readonly<{
  children: React.ReactNode;
  styleTokens: PreviewEmailStyleTokens;
}>): React.JSX.Element {
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
    <Container className="mx-auto mt-8 text-center">
      <Link
        className="text-signature-color text-xs"
        href="https://formbricks.com?utm_source=email_branding"
        style={{ ...getForcedColorStyle(signatureColor), fontFamily }}
        target={PREVIEW_LINK_TARGET}>
        {t("common.powered_by_formbricks")}
      </Link>
    </Container>
  );
}
