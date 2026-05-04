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
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { parseRecallInfo } from "@/lib/utils/recall";
import { RatingSmiley } from "@/modules/analysis/components/RatingSmiley";
import { resolveStorageUrl } from "@/modules/storage/utils";
import {
  CHOICE_LINK_CLASSNAME,
  PREVIEW_LINK_TARGET,
  type PreviewEmailStyleTokens,
  type PreviewMarkerVariant,
  SCALE_BUTTON_CLASSNAME,
  SECONDARY_BUTTON_CLASSNAME,
  getCenteredPlaceholderStyle,
  getCenteredPlaceholderTextStyle,
  getChoiceCardStyle,
  getChoiceMarkerClassName,
  getChoiceMarkerStyle,
  getFieldLabelStyle,
  getForcedBackgroundStyle,
  getForcedColorStyle,
  getHelperLabelTextStyle,
  getInputShellLinkStyle,
  getInputShellStyle,
  getInputTextStyle,
  getLightModeTextStyle,
  getPrefilledSurveyUrl,
  getPreviewAccentColor,
  getPreviewEmailStyleTokens,
  getPreviewSurveyUrl,
  getPrimaryButtonStyle,
  getScaleColumnStyle,
  getScaleOptionStyle,
  getSecondaryButtonStyle,
  importantStyle,
  normalizeRichTextSpacing,
} from "../lib/preview-email-template-styles";
import { getNPSOptionColor, getRatingNumberOptionColor } from "../lib/utils";

interface PreviewEmailTemplateProps {
  survey: TSurvey;
  surveyUrl: string;
  styling: TSurveyStyling;
  locale: string;
  t: TFunction;
}

interface PreviewFieldConfig {
  readonly id: string;
  readonly label: string;
}

interface PreviewChoiceConfig {
  readonly id: string;
  readonly label: Parameters<typeof getLocalizedValue>[0];
}

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
      let ratingOptionHeight: string | undefined;

      if (isNumberRating) {
        ratingOptionHeight = firstQuestion.isColorCodingEnabled ? "47px" : "41px";
      }

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
  optionStyle,
}: Readonly<{
  children: React.ReactNode;
  href: string;
  optionCount: number;
  optionStyle: React.CSSProperties;
}>): React.JSX.Element {
  return (
    <Column style={getScaleColumnStyle(optionCount)}>
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
