import { TFunction } from "i18next";
import {
  CalendarDaysIcon,
  type LucideIcon,
  SquareArrowOutUpRightIcon,
  StarIcon,
  UploadIcon,
} from "lucide-react";
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
import { COLOR_DEFAULTS, STYLE_DEFAULTS } from "@/lib/styling/constants";
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
  accentBackgroundColor: string;
  brandColor: string;
  buttonBackgroundColor: string;
  buttonBorderRadius: string;
  buttonFontSize: string;
  buttonFontWeight: string;
  buttonPaddingX: string;
  buttonPaddingY: string;
  buttonTextColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  elementDescriptionColor: string;
  elementDescriptionFontSize: string;
  elementDescriptionFontWeight: string;
  elementHeadlineColor: string;
  elementHeadlineFontSize: string;
  elementHeadlineFontWeight: string;
  elementUpperLabelColor: string;
  elementUpperLabelFontSize: string;
  elementUpperLabelFontWeight: string;
  fontFamily: string;
  inputBackgroundColor: string;
  inputBorderRadius: string;
  inputFontSize: string;
  inputHeight: string;
  inputPaddingX: string;
  inputPaddingY: string;
  inputPlaceholderEmailColor: string;
  inputShadow: string;
  inputTextColor: string;
  inputColor: string;
  inputBorderColor: string;
  optionBackgroundColor: string;
  optionBorderColor: string;
  optionBorderRadius: string;
  optionFontSize: string;
  optionLabelColor: string;
  optionPaddingX: string;
  optionPaddingY: string;
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

type PreviewMarkerVariant = "checkbox" | "radio" | "ranking";
type PreviewStyleValue = string | number | null | undefined;

const PREVIEW_LINK_TARGET = "_blank";
const SURVEY_EMAIL_FONT_FAMILY = "Inter, Helvetica, Arial, sans-serif";
const FORCE_LIGHT_COLOR_SCHEME = "only light";
const CHOICE_LINK_CLASSNAME =
  "bg-option-bg border-option-border text-option-label block rounded-option border border-solid px-option-x py-option-y font-survey text-option font-normal leading-5 no-underline";
const SECONDARY_BUTTON_CLASSNAME =
  "border-input-border inline-block rounded-button border border-solid px-button-x py-button-y font-survey text-button font-button leading-5 no-underline";
const SCALE_BUTTON_CLASSNAME =
  "border-input-border block w-full border border-solid p-0 text-center font-survey text-sm font-medium no-underline box-border";
const CHOICE_MARKER_CLASSNAME = "inline-block h-4 w-4 box-border align-middle leading-4";
const RICH_TEXT_PARAGRAPH_TAG_REGEX = /<p\b([^>]*)>/gi;
const RICH_TEXT_STYLE_ATTRIBUTE_REGEX = /\sstyle=(["'])(.*?)\1/i;
const importantStyle = (value: string): string => `${value} !important`;

const normalizeRichTextSpacing = (html: string): string =>
  html.replace(RICH_TEXT_PARAGRAPH_TAG_REGEX, (_tag, attributes: string = "") => {
    if (RICH_TEXT_STYLE_ATTRIBUTE_REGEX.test(attributes)) {
      return `<p${attributes.replace(
        RICH_TEXT_STYLE_ATTRIBUTE_REGEX,
        (_styleAttribute, quote: string, styleValue: string) =>
          ` style=${quote}${styleValue.trim() ? `${styleValue.trim()};` : ""}margin:0${quote}`
      )}>`;
    }

    return `<p${attributes} style="margin:0">`;
  });

const getPreviewDimension = (value: PreviewStyleValue, fallback: PreviewStyleValue): string => {
  const resolvedValue = value ?? fallback;

  if (resolvedValue === null || resolvedValue === undefined || resolvedValue === "") {
    return "";
  }

  if (typeof resolvedValue === "number") {
    return `${resolvedValue}px`;
  }

  if (typeof resolvedValue === "string" && !Number.isNaN(Number(resolvedValue))) {
    return `${resolvedValue}px`;
  }

  return typeof resolvedValue === "string" ? resolvedValue : "";
};

const getPreviewFontWeight = (value: PreviewStyleValue, fallback: PreviewStyleValue): string => {
  const resolvedValue = value ?? fallback;

  if (resolvedValue === null || resolvedValue === undefined || resolvedValue === "") {
    return "";
  }

  return typeof resolvedValue === "string" || typeof resolvedValue === "number"
    ? resolvedValue.toString()
    : "";
};

const getPreviewOpacity = (value: PreviewStyleValue, fallback: PreviewStyleValue): number => {
  const resolvedValue = value ?? fallback;
  const parsedValue = Number(resolvedValue);

  if (!Number.isFinite(parsedValue)) return 1;

  return Math.min(Math.max(parsedValue, 0), 1);
};

const getForcedBackgroundStyle = (color: string): React.CSSProperties => ({
  background: importantStyle(color),
  backgroundColor: importantStyle(color),
  colorScheme: FORCE_LIGHT_COLOR_SCHEME,
});

const getForcedColorStyle = (color: string): React.CSSProperties => ({
  color: importantStyle(color),
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
    return i + 1;
  }
  if (scale === "star") {
    return (
      <StarIcon
        color="#cbd5e1"
        fill="#cbd5e1"
        size={28}
        strokeWidth={2}
        style={{
          display: "inline-block",
          marginTop: "9px",
          verticalAlign: "middle",
        }}
      />
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
  const questionColor =
    styling.questionColor?.light ?? STYLE_DEFAULTS.questionColor?.light ?? COLOR_DEFAULTS.questionColor;
  const brandColor =
    styling.brandColor?.light ?? STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor;
  const inputTextColor = styling.inputTextColor?.light ?? questionColor;
  const inputBackgroundColor =
    styling.inputBgColor?.light ??
    styling.inputColor?.light ??
    STYLE_DEFAULTS.inputColor?.light ??
    COLOR_DEFAULTS.inputColor;
  const inputPlaceholderColor = mixColor(inputTextColor, "#ffffff", 0.3);
  const inputPlaceholderOpacity = getPreviewOpacity(
    styling.inputPlaceholderOpacity,
    STYLE_DEFAULTS.inputPlaceholderOpacity ?? 0.5
  );
  const optionBackgroundColor =
    styling.optionBgColor?.light ??
    styling.inputColor?.light ??
    STYLE_DEFAULTS.optionBgColor?.light ??
    COLOR_DEFAULTS.inputColor;
  const buttonBackgroundColor = styling.buttonBgColor?.light ?? brandColor;
  const previewRoundness = getPreviewRoundness(styling.roundness);
  const signatureColor = isLight(questionColor)
    ? mixColor(questionColor, "#000000", 0.2)
    : mixColor(questionColor, "#ffffff", 0.2);

  return {
    accentBackgroundColor: styling.accentBgColor?.light ?? mixColor(brandColor, "#ffffff", 0.8),
    brandColor,
    buttonBackgroundColor,
    buttonBorderRadius: getPreviewDimension(
      styling.buttonBorderRadius,
      STYLE_DEFAULTS.buttonBorderRadius ?? previewRoundness
    ),
    buttonFontSize: getPreviewDimension(styling.buttonFontSize, STYLE_DEFAULTS.buttonFontSize),
    buttonFontWeight: getPreviewFontWeight(styling.buttonFontWeight, STYLE_DEFAULTS.buttonFontWeight),
    buttonPaddingX: getPreviewDimension(styling.buttonPaddingX, STYLE_DEFAULTS.buttonPaddingX),
    buttonPaddingY: getPreviewDimension(styling.buttonPaddingY, STYLE_DEFAULTS.buttonPaddingY),
    buttonTextColor:
      styling.buttonTextColor?.light ?? (isLight(buttonBackgroundColor) ? "#0f172a" : "#ffffff"),
    cardBackgroundColor:
      styling.cardBackgroundColor?.light ??
      STYLE_DEFAULTS.cardBackgroundColor?.light ??
      COLOR_DEFAULTS.cardBackgroundColor,
    cardBorderColor:
      styling.cardBorderColor?.light ??
      STYLE_DEFAULTS.cardBorderColor?.light ??
      COLOR_DEFAULTS.cardBorderColor,
    elementDescriptionColor: styling.elementDescriptionColor?.light ?? questionColor,
    elementDescriptionFontSize: getPreviewDimension(
      styling.elementDescriptionFontSize,
      STYLE_DEFAULTS.elementDescriptionFontSize
    ),
    elementDescriptionFontWeight: getPreviewFontWeight(
      styling.elementDescriptionFontWeight,
      STYLE_DEFAULTS.elementDescriptionFontWeight
    ),
    elementHeadlineColor: styling.elementHeadlineColor?.light ?? questionColor,
    elementHeadlineFontSize: getPreviewDimension(
      styling.elementHeadlineFontSize,
      STYLE_DEFAULTS.elementHeadlineFontSize
    ),
    elementHeadlineFontWeight: getPreviewFontWeight(
      styling.elementHeadlineFontWeight,
      STYLE_DEFAULTS.elementHeadlineFontWeight
    ),
    elementUpperLabelColor: styling.elementUpperLabelColor?.light ?? questionColor,
    elementUpperLabelFontSize: getPreviewDimension(
      styling.elementUpperLabelFontSize,
      STYLE_DEFAULTS.elementUpperLabelFontSize
    ),
    elementUpperLabelFontWeight: getPreviewFontWeight(
      styling.elementUpperLabelFontWeight,
      STYLE_DEFAULTS.elementUpperLabelFontWeight
    ),
    fontFamily: styling.fontFamily ?? SURVEY_EMAIL_FONT_FAMILY,
    inputBackgroundColor,
    inputBorderColor:
      styling.inputBorderColor?.light ??
      STYLE_DEFAULTS.inputBorderColor?.light ??
      COLOR_DEFAULTS.inputBorderColor,
    inputBorderRadius: getPreviewDimension(
      styling.inputBorderRadius,
      STYLE_DEFAULTS.inputBorderRadius ?? previewRoundness
    ),
    inputColor: styling.inputColor?.light ?? STYLE_DEFAULTS.inputColor?.light ?? COLOR_DEFAULTS.inputColor,
    inputFontSize: getPreviewDimension(styling.inputFontSize, STYLE_DEFAULTS.inputFontSize),
    inputHeight: getPreviewDimension(styling.inputHeight, STYLE_DEFAULTS.inputHeight),
    inputPaddingX: getPreviewDimension(styling.inputPaddingX, STYLE_DEFAULTS.inputPaddingX),
    inputPaddingY: getPreviewDimension(styling.inputPaddingY, STYLE_DEFAULTS.inputPaddingY),
    inputPlaceholderEmailColor: mixColor(
      inputPlaceholderColor,
      inputBackgroundColor,
      1 - inputPlaceholderOpacity
    ),
    inputShadow: styling.inputShadow ?? STYLE_DEFAULTS.inputShadow ?? "",
    inputTextColor,
    optionBackgroundColor,
    optionBorderColor:
      styling.optionBorderColor?.light ??
      styling.inputBorderColor?.light ??
      STYLE_DEFAULTS.optionBorderColor?.light ??
      COLOR_DEFAULTS.inputBorderColor,
    optionBorderRadius: getPreviewDimension(
      styling.optionBorderRadius,
      STYLE_DEFAULTS.optionBorderRadius ?? previewRoundness
    ),
    optionFontSize: getPreviewDimension(styling.optionFontSize, STYLE_DEFAULTS.optionFontSize),
    optionLabelColor: styling.optionLabelColor?.light ?? questionColor,
    optionPaddingX: getPreviewDimension(styling.optionPaddingX, STYLE_DEFAULTS.optionPaddingX),
    optionPaddingY: getPreviewDimension(styling.optionPaddingY, STYLE_DEFAULTS.optionPaddingY),
    questionColor,
    roundness: previewRoundness,
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
  ...getForcedBackgroundStyle(styleTokens.optionBackgroundColor),
  border: importantStyle(`1px solid ${styleTokens.optionBorderColor}`),
});

const getChoiceTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.optionLabelColor),
});

const getChoiceCardStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getChoiceBlockStyle(styleTokens),
  ...getChoiceTextStyle(styleTokens),
  textDecoration: "none",
});

const getFieldPlaceholderStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedBackgroundStyle(styleTokens.inputBackgroundColor),
  ...getForcedColorStyle(styleTokens.inputPlaceholderEmailColor),
  border: importantStyle(`1px solid ${styleTokens.inputBorderColor}`),
});

const getInputTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.inputTextColor),
});

const getFieldLabelStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
});

const getSecondaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  border: importantStyle(`1px solid ${styleTokens.inputBorderColor}`),
  ...getForcedColorStyle(styleTokens.questionColor),
});

const getPrimaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getSecondaryButtonStyle(styleTokens),
  ...getForcedBackgroundStyle(styleTokens.buttonBackgroundColor),
  border: importantStyle(`1px solid ${styleTokens.buttonBackgroundColor}`),
  ...getForcedColorStyle(styleTokens.buttonTextColor),
});

const getPreviewAccentColor = (token?: string): string | undefined =>
  token ? EMAIL_PREVIEW_ACCENT_COLORS[token as keyof typeof EMAIL_PREVIEW_ACCENT_COLORS] : undefined;

const getConnectedScaleBorderRadius = (
  styleTokens: PreviewEmailStyleTokens,
  optionIndex: number,
  optionCount: number
): string => {
  if (optionCount <= 1) return styleTokens.inputBorderRadius;

  if (optionIndex === 0) return `${styleTokens.inputBorderRadius} 0 0 ${styleTokens.inputBorderRadius}`;
  if (optionIndex === optionCount - 1)
    return `0 ${styleTokens.inputBorderRadius} ${styleTokens.inputBorderRadius} 0`;

  return "0";
};

const getScaleLineHeight = (height: string, hasColorStrip: boolean): string => {
  if (!hasColorStrip || !height.endsWith("px")) return height;

  const numericHeight = Number.parseFloat(height);

  if (!Number.isFinite(numericHeight)) return height;

  return `${Math.max(numericHeight - 6, 0).toString()}px`;
};

const getScaleOptionStyle = ({
  styleTokens,
  borderTopColor,
  height,
  isConnected = false,
  isCompact = false,
  isTransparent = false,
  optionCount = 0,
  optionIndex = 0,
}: {
  styleTokens: PreviewEmailStyleTokens;
  borderTopColor?: string;
  height?: string;
  isConnected?: boolean;
  isCompact?: boolean;
  isTransparent?: boolean;
  optionCount?: number;
  optionIndex?: number;
}): React.CSSProperties => {
  const optionHeight = height ?? (isCompact ? "40px" : "46px");
  const optionLineHeight = getScaleLineHeight(optionHeight, Boolean(borderTopColor));
  const shouldConnect = isConnected && optionCount > 0;

  return {
    ...getForcedBackgroundStyle(isTransparent ? "transparent" : styleTokens.inputBackgroundColor),
    border: importantStyle(
      isTransparent ? "1px solid transparent" : `1px solid ${styleTokens.inputBorderColor}`
    ),
    borderRadius: shouldConnect
      ? getConnectedScaleBorderRadius(styleTokens, optionIndex, optionCount)
      : styleTokens.inputBorderRadius,
    ...(shouldConnect && optionIndex > 0 ? { borderLeft: importantStyle("0") } : {}),
    ...getForcedColorStyle(styleTokens.inputTextColor),
    height: optionHeight,
    lineHeight: optionLineHeight,
    ...(borderTopColor ? { borderTop: importantStyle(`6px solid ${borderTopColor}`) } : {}),
  };
};

const getLightModeTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.elementHeadlineColor),
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.elementHeadlineFontSize,
  fontWeight: styleTokens.elementHeadlineFontWeight,
});

const getHelperLabelTextStyle = (styleTokens: PreviewEmailStyleTokens): React.CSSProperties => ({
  ...getForcedColorStyle(styleTokens.elementUpperLabelColor),
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.elementUpperLabelFontSize,
  fontWeight: styleTokens.elementUpperLabelFontWeight,
});

const getCenteredPlaceholderStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getFieldPlaceholderStyle(styleTokens),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const getCenteredPlaceholderTextStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    ...getForcedColorStyle(styleTokens.inputPlaceholderEmailColor),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

const getInputShellStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => ({
  ...getCenteredPlaceholderStyle(styleTokens),
  boxSizing: "border-box",
  borderRadius: styleTokens.inputBorderRadius,
  display: "block",
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.inputFontSize,
  lineHeight: "20px",
  overflow: "hidden",
  padding: `${styleTokens.inputPaddingY} ${styleTokens.inputPaddingX}`,
  width: "100%",
  ...(overrides ?? {}),
});

const getInputShellLinkStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: React.CSSProperties
): React.CSSProperties => ({
  ...getInputTextStyle(styleTokens),
  display: "block",
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.inputFontSize,
  fontWeight: 400,
  lineHeight: "20px",
  textDecoration: importantStyle("none"),
  width: "100%",
  ...(overrides ?? {}),
});

const getScaleColumnStyle = (_optionIndex: number, optionCount: number): React.CSSProperties => ({
  width: `${(100 / optionCount).toFixed(4)}%`,
});

const getChoiceMarkerStyle = (
  marker: PreviewMarkerVariant,
  styleTokens: PreviewEmailStyleTokens
): React.CSSProperties => ({
  ...(marker === "ranking"
    ? {
        background: importantStyle("transparent"),
        backgroundColor: importantStyle("transparent"),
        colorScheme: FORCE_LIGHT_COLOR_SCHEME,
      }
    : getForcedBackgroundStyle("#ffffff")),
  border: importantStyle(
    `${marker === "ranking" ? "1px dashed" : "1px solid"} ${
      marker === "ranking" ? styleTokens.brandColor : styleTokens.inputBorderColor
    }`
  ),
});

const getChoiceMarkerClassName = (marker: PreviewMarkerVariant, withLabelGap = true): string =>
  `${withLabelGap ? "mr-3 " : ""}${CHOICE_MARKER_CLASSNAME} ${
    marker === "checkbox" ? "rounded" : "rounded-full"
  }`;

const renderChoiceLabel = (
  marker: PreviewMarkerVariant,
  label: string,
  styleTokens: PreviewEmailStyleTokens
): React.JSX.Element => (
  <>
    <span className={getChoiceMarkerClassName(marker)} style={getChoiceMarkerStyle(marker, styleTokens)}>
      {"\u00A0"}
    </span>
    <span style={{ verticalAlign: "middle" }}>{label}</span>
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
      headline={normalizeRichTextSpacing(headline)}
      style={getLightModeTextStyle(styleTokens)}
      subheader={subheader ? normalizeRichTextSpacing(subheader) : undefined}
      subheaderStyle={{
        ...getForcedColorStyle(styleTokens.elementDescriptionColor),
        fontSize: styleTokens.elementDescriptionFontSize,
        fontWeight: styleTokens.elementDescriptionFontWeight,
      }}
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

  switch (firstQuestion.type) {
    case TSurveyElementTypeEnum.OpenText: {
      const openTextPlaceholder = firstQuestion.placeholder
        ? getLocalizedValue(firstQuestion.placeholder, defaultLanguageCode)
        : "";
      const isLongAnswer = firstQuestion.longAnswer !== false;
      const openTextInputHeightStyle = isLongAnswer
        ? { height: "64px", minHeight: "64px" }
        : {
            minHeight: styleTokens.inputHeight,
          };
      const openTextInputShellStyle = getCenteredPlaceholderStyle(styleTokens, {
        ...getInputShellStyle(styleTokens, openTextInputHeightStyle),
        textAlign: "left",
      });
      const openTextPlaceholderStyle = getCenteredPlaceholderTextStyle(styleTokens, {
        fontFamily: styleTokens.fontFamily,
        fontSize: styleTokens.inputFontSize,
        fontWeight: 400,
        lineHeight: "20px",
        textDecoration: importantStyle("none"),
      });

      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Section className="w-full">
            <table
              border={0}
              cellPadding="0"
              cellSpacing="0"
              role="presentation"
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                marginTop: "1rem",
                width: "100%",
              }}
              width="100%">
              <tbody>
                <tr>
                  <td style={{ width: "100%" }}>
                    <div style={openTextInputShellStyle}>
                      <Link
                        className="font-survey text-input text-input-placeholder no-underline"
                        href={previewSurveyUrl}
                        style={openTextPlaceholderStyle}
                        target={PREVIEW_LINK_TARGET}>
                        <span style={openTextPlaceholderStyle}>{openTextPlaceholder || "\u00A0"}</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.Consent:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <Section className="mt-4 w-full">
            <div style={getInputShellStyle(styleTokens)}>
              <span
                style={{
                  ...getInputTextStyle(styleTokens),
                  fontFamily: styleTokens.fontFamily,
                  fontSize: "16px",
                  fontWeight: 500,
                  lineHeight: "24px",
                }}>
                {getLocalizedValue(firstQuestion.label, defaultLanguageCode)}
              </span>
            </div>
          </Section>
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
                ...getPrimaryButtonStyle(styleTokens),
                marginLeft: firstQuestion.required ? 0 : "8px",
              }}
              href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, "accepted")}
              target={PREVIEW_LINK_TARGET}>
              {t("emails.accept")}
            </EmailButton>
          </Section>
        </PreviewQuestionCard>
      );
    case TSurveyElementTypeEnum.NPS: {
      const npsOptionCount = 11;
      const npsOptionHeight = firstQuestion.isColorCodingEnabled ? "47px" : "41px";

      return (
        <PreviewEmailCard styleTokens={styleTokens} t={t}>
          <Section className="w-full">
            <PreviewElementHeader headline={headline} subheader={subheader} styleTokens={styleTokens} />
            <Container className="mx-0 mt-4 w-full max-w-none">
              <Section className="w-full">
                <Row>
                  {Array.from({ length: npsOptionCount }, (_, i) => (
                    <PreviewScaleOptionColumn
                      key={i}
                      href={getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, i.toString())}
                      optionCount={npsOptionCount}
                      optionIndex={i}
                      optionStyle={getScaleOptionStyle({
                        styleTokens,
                        borderTopColor: firstQuestion.isColorCodingEnabled
                          ? getPreviewAccentColor(getNPSOptionColor(i))
                          : undefined,
                        height: npsOptionHeight,
                        isConnected: true,
                        optionCount: npsOptionCount,
                        optionIndex: i,
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
    }
    case TSurveyElementTypeEnum.CTA: {
      const ctaElement = firstQuestion as TSurveyCTAElement;
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          {ctaElement.buttonExternal && ctaElement.ctaButtonLabel && ctaElement.buttonUrl && (
            <Section className="mt-4 text-left" style={{ textAlign: "left" }}>
              <EmailButton
                className={SECONDARY_BUTTON_CLASSNAME}
                style={getPrimaryButtonStyle(styleTokens)}
                href={ctaElement.buttonUrl}
                target={PREVIEW_LINK_TARGET}>
                {getLocalizedValue(ctaElement.ctaButtonLabel, defaultLanguageCode)}
                <SquareArrowOutUpRightIcon
                  color={styleTokens.buttonTextColor}
                  size={16}
                  strokeWidth={2}
                  style={{
                    display: "inline-block",
                    marginLeft: "8px",
                    verticalAlign: "text-bottom",
                  }}
                />
              </EmailButton>
            </Section>
          )}
        </PreviewQuestionCard>
      );
    }
    case TSurveyElementTypeEnum.Rating: {
      const isNumberRating = firstQuestion.scale === "number";
      const ratingOptionHeight = isNumberRating
        ? firstQuestion.isColorCodingEnabled
          ? "47px"
          : "41px"
        : undefined;

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
                          firstQuestion.isColorCodingEnabled && isNumberRating
                            ? getPreviewAccentColor(getRatingNumberOptionColor(firstQuestion.range, i + 1))
                            : undefined,
                        height: ratingOptionHeight,
                        isConnected: isNumberRating,
                        isTransparent: firstQuestion.scale === "star",
                        optionCount: firstQuestion.range,
                        optionIndex: i,
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
    }
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return (
        <PreviewQuestionCard headline={headline} styleTokens={styleTokens} subheader={subheader} t={t}>
          <PreviewChoiceList
            choices={firstQuestion.choices}
            defaultLanguageCode={defaultLanguageCode}
            getHref={(choiceId) => getPrefilledSurveyUrl(surveyUrl, firstQuestion.id, choiceId)}
            marker="checkbox"
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
            marker="ranking"
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
            marker="radio"
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
                style={getPrimaryButtonStyle(styleTokens)}
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
            <PreviewInputLink
              href={previewSurveyUrl}
              icon={CalendarDaysIcon}
              label={t("emails.select_a_date")}
              styleTokens={styleTokens}
            />
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
                    className={rowIndex % 2 === 0 ? "bg-input-color" : ""}
                    key={row.id}
                    style={
                      rowIndex % 2 === 0
                        ? {
                            ...getForcedBackgroundStyle(styleTokens.inputBackgroundColor),
                          }
                        : undefined
                    }>
                    <Column className="w-40 break-words px-4 py-2" style={getLightModeTextStyle(styleTokens)}>
                      {getLocalizedValue(row.label, "default")}
                    </Column>
                    {firstQuestion.columns.map((column) => {
                      return (
                        <Column
                          className="text-question-color px-4 py-2 text-center"
                          key={column.id}
                          style={{ ...getLightModeTextStyle(styleTokens), textAlign: "center" }}>
                          <span
                            className={getChoiceMarkerClassName("radio", false)}
                            style={getChoiceMarkerStyle("radio", styleTokens)}>
                            {"\u00A0"}
                          </span>
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
              style={getPrimaryButtonStyle(styleTokens)}
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
            <PreviewInputLink
              href={previewSurveyUrl}
              icon={UploadIcon}
              isAccent
              isContentVerticallyCentered
              isDashed
              label={t("emails.click_or_drag_to_upload_files")}
              minHeight="96px"
              styleTokens={styleTokens}
            />
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
  marker?: PreviewMarkerVariant;
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

function PreviewInputLink({
  href,
  icon: Icon,
  isAccent = false,
  isContentVerticallyCentered = false,
  isDashed = false,
  label,
  minHeight,
  styleTokens,
}: Readonly<{
  href: string;
  icon?: LucideIcon;
  isAccent?: boolean;
  isContentVerticallyCentered?: boolean;
  isDashed?: boolean;
  label: string;
  minHeight?: string;
  styleTokens: PreviewEmailStyleTokens;
}>): React.JSX.Element {
  const shellStyle = getInputShellStyle(styleTokens, {
    ...(isAccent ? getForcedBackgroundStyle(styleTokens.accentBackgroundColor) : {}),
    ...(isDashed ? { border: importantStyle(`2px dashed ${styleTokens.inputBorderColor}`) } : {}),
    marginTop: "1rem",
    textAlign: "center",
    ...(minHeight ? { minHeight } : {}),
    ...(isContentVerticallyCentered && minHeight
      ? { height: minHeight, paddingBottom: 0, paddingTop: 0 }
      : {}),
  });
  const linkStyle = getInputShellLinkStyle(styleTokens, {
    textAlign: "center",
    ...(isContentVerticallyCentered && minHeight ? { height: minHeight, lineHeight: minHeight } : {}),
  });

  return (
    <table
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}
      width="100%">
      <tbody>
        <tr>
          <td style={{ width: "100%" }}>
            <div style={shellStyle}>
              <Link
                className="font-survey text-input text-input-text block w-full text-center font-normal no-underline"
                href={href}
                style={linkStyle}
                target={PREVIEW_LINK_TARGET}>
                {Icon ? (
                  <Icon
                    color={styleTokens.inputTextColor}
                    size={18}
                    strokeWidth={2}
                    style={{
                      display: "inline-block",
                      marginRight: "8px",
                      verticalAlign: "middle",
                    }}
                  />
                ) : null}
                <span style={{ verticalAlign: "middle" }}>{label}</span>
              </Link>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
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
        <Section className="mt-3 w-full" key={field.id}>
          <Text
            className="text-question-color font-survey m-0 mb-2 text-sm font-normal leading-6"
            style={getFieldLabelStyle(styleTokens)}>
            {field.label}
          </Text>
          <div style={getInputShellStyle(styleTokens)}>
            <Link
              className="font-survey text-input text-input-placeholder block w-full no-underline"
              href={href}
              style={getInputShellLinkStyle(styleTokens)}
              target={PREVIEW_LINK_TARGET}>
              {"\u00A0"}
            </Link>
          </div>
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
      <Link className={SCALE_BUTTON_CLASSNAME} href={href} style={optionStyle} target={PREVIEW_LINK_TARGET}>
        {children}
      </Link>
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
    "accent-bg": styleTokens.accentBackgroundColor,
    "brand-color": styleTokens.brandColor,
    "button-bg": styleTokens.buttonBackgroundColor,
    "button-text": styleTokens.buttonTextColor,
    "card-bg-color": styleTokens.cardBackgroundColor,
    "input-color": styleTokens.inputColor,
    "input-bg": styleTokens.inputBackgroundColor,
    "input-border-color": styleTokens.inputBorderColor,
    "input-border": styleTokens.inputBorderColor,
    "input-placeholder": styleTokens.inputPlaceholderEmailColor,
    "input-text": styleTokens.inputTextColor,
    "option-bg": styleTokens.optionBackgroundColor,
    "option-border": styleTokens.optionBorderColor,
    "option-label": styleTokens.optionLabelColor,
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
              button: styleTokens.buttonBorderRadius,
              input: styleTokens.inputBorderRadius,
              option: styleTokens.optionBorderRadius,
            },
            boxShadow: {
              input: styleTokens.inputShadow,
            },
            fontFamily: {
              survey: styleTokens.fontFamily,
            },
            fontSize: {
              button: styleTokens.buttonFontSize,
              input: styleTokens.inputFontSize,
              option: styleTokens.optionFontSize,
            },
            fontWeight: {
              button: styleTokens.buttonFontWeight,
            },
            spacing: {
              "button-x": styleTokens.buttonPaddingX,
              "button-y": styleTokens.buttonPaddingY,
              "input-x": styleTokens.inputPaddingX,
              "input-y": styleTokens.inputPaddingY,
              "option-x": styleTokens.optionPaddingX,
              "option-y": styleTokens.optionPaddingY,
            },
          },
        },
      }}>
      <Section
        bgcolor={styleTokens.cardBackgroundColor}
        className="bg-card-bg-color border-card-border-color rounded-custom mx-0 my-2 border border-solid p-8 text-inherit"
        style={{
          ...getForcedBackgroundStyle(styleTokens.cardBackgroundColor),
          border: importantStyle(`1px solid ${styleTokens.cardBorderColor}`),
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
