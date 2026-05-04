import type { CSSProperties } from "react";
import type { TSurveyStyling } from "@formbricks/types/surveys/types";
import { COLOR_DEFAULTS, STYLE_DEFAULTS } from "@/lib/styling/constants";
import { isLight, mixColor } from "@/lib/utils/colors";

export interface PreviewEmailStyleTokens {
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

export type PreviewMarkerVariant = "checkbox" | "radio" | "ranking";
type PreviewStyleValue = string | number | null | undefined;

export const PREVIEW_LINK_TARGET = "_blank";
const SURVEY_EMAIL_FONT_FAMILY = "Inter, Helvetica, Arial, sans-serif";
const FORCE_LIGHT_COLOR_SCHEME = "only light";

export const CHOICE_LINK_CLASSNAME =
  "bg-option-bg border-option-border text-option-label block rounded-option border border-solid px-option-x py-option-y font-survey text-option font-normal leading-5 no-underline";
export const SECONDARY_BUTTON_CLASSNAME =
  "border-input-border inline-block rounded-button border border-solid px-button-x py-button-y font-survey text-button font-button leading-5 no-underline";
export const SCALE_BUTTON_CLASSNAME =
  "border-input-border block w-full border border-solid p-0 text-center font-survey text-sm font-medium no-underline box-border";
const CHOICE_MARKER_CLASSNAME = "inline-block h-4 w-4 box-border align-middle leading-4";

const EMAIL_PREVIEW_ACCENT_COLORS = {
  "bg-emerald-100": "#d1fae5",
  "bg-orange-100": "#ffedd5",
  "bg-rose-100": "#ffe4e6",
  "emerald-100": "#d1fae5",
  "orange-100": "#ffedd5",
  "rose-100": "#ffe4e6",
} as const;

const RICH_TEXT_PARAGRAPH_TAG_REGEX = /<p\b([^>]*)>/gi;
const RICH_TEXT_STYLE_ATTRIBUTE_REGEX = /\sstyle=(["'])(.*?)\1/i;
const RICH_TEXT_STYLE_ATTRIBUTE_REPLACE_REGEX = /\sstyle=(["'])(.*?)\1/gi;

export const importantStyle = (value: string): string => `${value} !important`;

export const normalizeRichTextSpacing = (html: string): string =>
  html.replaceAll(RICH_TEXT_PARAGRAPH_TAG_REGEX, (_tag, attributes: string = "") => {
    if (RICH_TEXT_STYLE_ATTRIBUTE_REGEX.test(attributes)) {
      return `<p${attributes.replaceAll(
        RICH_TEXT_STYLE_ATTRIBUTE_REPLACE_REGEX,
        (_styleAttribute, quote: string, styleValue: string) => {
          const trimmedStyle = styleValue.trim();
          const styleWithMargin = trimmedStyle ? `${trimmedStyle};margin:0` : "margin:0";

          return ` style=${quote}${styleWithMargin}${quote}`;
        }
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

export const getForcedBackgroundStyle = (color: string): CSSProperties => ({
  background: importantStyle(color),
  backgroundColor: importantStyle(color),
  colorScheme: FORCE_LIGHT_COLOR_SCHEME,
});

export const getForcedColorStyle = (color: string): CSSProperties => ({
  color: importantStyle(color),
  colorScheme: FORCE_LIGHT_COLOR_SCHEME,
});

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

export const getPreviewEmailStyleTokens = (styling: TSurveyStyling): PreviewEmailStyleTokens => {
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

export const getPreviewSurveyUrl = (surveyUrl: string): string =>
  buildSurveyEmailUrl(surveyUrl, [["preview", "true"]]);

export const getPrefilledSurveyUrl = (surveyUrl: string, questionId: string, value: string): string =>
  buildSurveyEmailUrl(surveyUrl, [
    ["preview", "true"],
    [questionId, value],
    ["skipPrefilled", "true"],
  ]);

const getChoiceBlockStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedBackgroundStyle(styleTokens.optionBackgroundColor),
  border: importantStyle(`1px solid ${styleTokens.optionBorderColor}`),
});

const getChoiceTextStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedColorStyle(styleTokens.optionLabelColor),
});

export const getChoiceCardStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getChoiceBlockStyle(styleTokens),
  ...getChoiceTextStyle(styleTokens),
  textDecoration: "none",
});

const getFieldPlaceholderStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedBackgroundStyle(styleTokens.inputBackgroundColor),
  ...getForcedColorStyle(styleTokens.inputPlaceholderEmailColor),
  border: importantStyle(`1px solid ${styleTokens.inputBorderColor}`),
});

export const getInputTextStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedColorStyle(styleTokens.inputTextColor),
});

export const getFieldLabelStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedColorStyle(styleTokens.questionColor),
  fontFamily: styleTokens.fontFamily,
});

export const getSecondaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  border: importantStyle(`1px solid ${styleTokens.inputBorderColor}`),
  ...getForcedColorStyle(styleTokens.questionColor),
});

export const getPrimaryButtonStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getSecondaryButtonStyle(styleTokens),
  ...getForcedBackgroundStyle(styleTokens.buttonBackgroundColor),
  border: importantStyle(`1px solid ${styleTokens.buttonBackgroundColor}`),
  ...getForcedColorStyle(styleTokens.buttonTextColor),
});

export const getPreviewAccentColor = (token?: string): string | undefined =>
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

export const getScaleOptionStyle = ({
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
}): CSSProperties => {
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

export const getLightModeTextStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedColorStyle(styleTokens.elementHeadlineColor),
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.elementHeadlineFontSize,
  fontWeight: styleTokens.elementHeadlineFontWeight,
});

export const getHelperLabelTextStyle = (styleTokens: PreviewEmailStyleTokens): CSSProperties => ({
  ...getForcedColorStyle(styleTokens.elementUpperLabelColor),
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.elementUpperLabelFontSize,
  fontWeight: styleTokens.elementUpperLabelFontWeight,
});

export const getCenteredPlaceholderStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: CSSProperties
): CSSProperties => {
  const baseStyle: CSSProperties = {
    ...getFieldPlaceholderStyle(styleTokens),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

export const getCenteredPlaceholderTextStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: CSSProperties
): CSSProperties => {
  const baseStyle: CSSProperties = {
    ...getForcedColorStyle(styleTokens.inputPlaceholderEmailColor),
  };

  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
};

export const getInputShellStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: CSSProperties
): CSSProperties => ({
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
  ...overrides,
});

export const getInputShellLinkStyle = (
  styleTokens: PreviewEmailStyleTokens,
  overrides?: CSSProperties
): CSSProperties => ({
  ...getInputTextStyle(styleTokens),
  display: "block",
  fontFamily: styleTokens.fontFamily,
  fontSize: styleTokens.inputFontSize,
  fontWeight: 400,
  lineHeight: "20px",
  textDecoration: importantStyle("none"),
  width: "100%",
  ...overrides,
});

export const getScaleColumnStyle = (optionCount: number): CSSProperties => ({
  width: `${(100 / optionCount).toFixed(4)}%`,
});

export const getChoiceMarkerStyle = (
  marker: PreviewMarkerVariant,
  styleTokens: PreviewEmailStyleTokens
): CSSProperties => ({
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

export const getChoiceMarkerClassName = (marker: PreviewMarkerVariant, withLabelGap = true): string =>
  `${withLabelGap ? "mr-3 " : ""}${CHOICE_MARKER_CLASSNAME} ${
    marker === "checkbox" ? "rounded" : "rounded-full"
  }`;
