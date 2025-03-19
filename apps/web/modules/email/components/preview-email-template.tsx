import { RatingSmiley } from "@/modules/analysis/components/RatingSmiley";
import {
  Column,
  Container,
  Button as EmailButton,
  Img,
  Link,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { TFnType } from "@tolgee/react";
import { CalendarDaysIcon, UploadIcon } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { isLight, mixColor } from "@formbricks/lib/utils/colors";
import { parseRecallInfo } from "@formbricks/lib/utils/recall";
import { type TSurvey, TSurveyQuestionTypeEnum, type TSurveyStyling } from "@formbricks/types/surveys/types";
import { getNPSOptionColor, getRatingNumberOptionColor } from "../lib/utils";

interface PreviewEmailTemplateProps {
  survey: TSurvey;
  surveyUrl: string;
  styling: TSurveyStyling;
  locale: string;
  t: TFnType;
}

export const getPreviewEmailTemplateHtml = async (
  survey: TSurvey,
  surveyUrl: string,
  styling: TSurveyStyling,
  locale: string,
  t: TFnType
): Promise<string> => {
  return render(
    <PreviewEmailTemplate styling={styling} survey={survey} surveyUrl={surveyUrl} locale={locale} t={t} />,
    {
      pretty: true,
    }
  );
};

export async function PreviewEmailTemplate({
  survey,
  surveyUrl,
  styling,
  t,
}: PreviewEmailTemplateProps): Promise<React.JSX.Element> {
  const url = `${surveyUrl}?preview=true`;
  const urlWithPrefilling = `${surveyUrl}?preview=true&skipPrefilled=true&`;
  const defaultLanguageCode = "default";
  const firstQuestion = survey.questions[0];
  const headline = parseRecallInfo(getLocalizedValue(firstQuestion.headline, defaultLanguageCode));
  const subheader = parseRecallInfo(getLocalizedValue(firstQuestion.subheader, defaultLanguageCode));
  const brandColor = styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor;

  switch (firstQuestion.type) {
    case TSurveyQuestionTypeEnum.OpenText:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">{subheader}</Text>
          <Section className="border-input-border-color rounded-custom mt-4 block h-20 w-full border border-solid bg-slate-50" />
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Consent:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 block text-base font-semibold leading-6">{headline}</Text>
          <Container className="text-question-color m-0 text-sm font-normal leading-6">
            <div
              className="m-0 p-0"
              dangerouslySetInnerHTML={{
                __html: getLocalizedValue(firstQuestion.html, defaultLanguageCode) || "",
              }}
            />
          </Container>

          <Container className="border-input-border-color bg-input-color rounded-custom m-0 mt-4 block w-full max-w-none border border-solid p-4 font-medium text-slate-800">
            <Text className="text-question-color m-0 inline-block">
              {getLocalizedValue(firstQuestion.label, defaultLanguageCode)}
            </Text>
          </Container>
          <Container className="mx-0 mt-4 flex max-w-none justify-end">
            {!firstQuestion.required && (
              <EmailButton
                className="rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium text-black"
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}>
                {t("emails.reject")}
              </EmailButton>
            )}
            <EmailButton
              className={cn(
                "bg-brand-color rounded-custom ml-2 inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}
              href={`${urlWithPrefilling}${firstQuestion.id}=accepted`}>
              {t("emails.accept")}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.NPS:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Section className="w-full justify-center">
            <Text className="text-question-color m-0 block w-full text-base font-semibold leading-6">
              {headline}
            </Text>
            <Text className="text-question-color m-0 block w-full p-0 text-sm font-normal leading-6">
              {subheader}
            </Text>
            <Container className="mx-0 mt-4 w-full items-center justify-center">
              <Section
                className={cn("w-full overflow-hidden", {
                  "border border-solid border-slate-200": firstQuestion.scale === "number",
                })}>
                <Row>
                  <Column className="mb-4 flex w-full justify-between gap-0">
                    {Array.from({ length: 11 }, (_, i) => (
                      <EmailButton
                        href={`${urlWithPrefilling}${firstQuestion.id}=${i.toString()}`}
                        key={i}
                        className={cn(
                          firstQuestion.isColorCodingEnabled ? "h-[46px]" : "h-10",
                          "relative m-0 w-full overflow-hidden border border-l-0 border-solid border-slate-200 p-0 text-center align-middle leading-10 text-slate-800",
                          { "rounded-l-lg border-l": i === 0 },
                          { "rounded-r-lg": i === 10 }
                        )}>
                        {firstQuestion.isColorCodingEnabled ? (
                          <Section
                            className={`absolute left-0 top-0 h-[6px] w-full ${getNPSOptionColor(i)}`}
                          />
                        ) : null}
                        {i}
                      </EmailButton>
                    ))}
                  </Column>
                </Row>
              </Section>
              <Section className="text-question-color mt-2 px-1.5 text-xs leading-6">
                <Row>
                  <Column>
                    <Text className="m-0 inline-block w-max p-0">
                      {getLocalizedValue(firstQuestion.lowerLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                  <Column className="text-right">
                    <Text className="m-0 inline-block w-max p-0 text-right">
                      {getLocalizedValue(firstQuestion.upperLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Container>
            <EmailFooter />
          </Section>
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.CTA:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 block text-base font-semibold leading-6">{headline}</Text>
          <Container className="text-question-color ml-0 mt-2 text-sm font-normal leading-6">
            <div
              className="m-0 p-0"
              dangerouslySetInnerHTML={{
                __html: getLocalizedValue(firstQuestion.html, defaultLanguageCode) || "",
              }}
            />
          </Container>

          <Container className="mx-0 mt-4 max-w-none">
            {!firstQuestion.required && (
              <EmailButton
                className="rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium text-black"
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}>
                {getLocalizedValue(firstQuestion.dismissButtonLabel, defaultLanguageCode) || "Skip"}
              </EmailButton>
            )}
            <EmailButton
              className={cn(
                "bg-brand-color rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}
              href={`${urlWithPrefilling}${firstQuestion.id}=clicked`}>
              {getLocalizedValue(firstQuestion.buttonLabel, defaultLanguageCode)}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Rating:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Section className="w-full">
            <Text className="text-question-color m-0 block text-base font-semibold leading-6">
              {headline}
            </Text>
            <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
              {subheader}
            </Text>
            <Container className="mx-0 mt-4 w-full items-center justify-center">
              <Section className="w-full overflow-hidden">
                <Row>
                  <Column className="flex w-full justify-around">
                    {Array.from({ length: firstQuestion.range }, (_, i) => (
                      <EmailButton
                        className={cn(
                          "relative m-0 flex w-full items-center justify-center overflow-hidden border border-l-0 border-solid border-gray-200 p-0 text-center align-middle leading-10 text-slate-800",

                          { "rounded-l-lg border-l": i === 0 },
                          { "rounded-r-lg": i === firstQuestion.range - 1 },
                          firstQuestion.isColorCodingEnabled && firstQuestion.scale === "number"
                            ? "h-[46px]"
                            : "h-10",
                          firstQuestion.scale === "star" ? "h-12" : "h-10"
                        )}
                        href={`${urlWithPrefilling}${firstQuestion.id}=${(i + 1).toString()}`}
                        key={i}>
                        {firstQuestion.scale === "smiley" && (
                          <RatingSmiley
                            active={false}
                            idx={i}
                            range={firstQuestion.range}
                            addColors={firstQuestion.isColorCodingEnabled}
                          />
                        )}
                        {firstQuestion.scale === "number" && (
                          <>
                            {firstQuestion.isColorCodingEnabled ? (
                              <Section
                                className={`absolute left-0 top-0 h-[6px] w-full ${getRatingNumberOptionColor(firstQuestion.range, i + 1)}`}
                              />
                            ) : null}
                            <Text className="m-0 flex h-10 items-center">{i + 1}</Text>
                          </>
                        )}
                        {firstQuestion.scale === "star" && <Text className="m-0 text-3xl">⭐</Text>}
                      </EmailButton>
                    ))}
                  </Column>
                </Row>
              </Section>
              <Section className="text-question-color m-0 px-1.5 text-xs leading-6">
                <Row>
                  <Column>
                    <Text className="m-0 inline-block p-0">
                      {getLocalizedValue(firstQuestion.lowerLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                  <Column className="text-right">
                    <Text className="m-0 inline-block p-0 text-right">
                      {getLocalizedValue(firstQuestion.upperLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Container>
            <EmailFooter />
          </Section>
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.MultipleChoiceMulti:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section
                className="border-input-border-color bg-input-color text-question-color rounded-custom mt-2 block w-full border border-solid p-4"
                key={choice.id}>
                {getLocalizedValue(choice.label, defaultLanguageCode)}
              </Section>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Ranking:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section
                className="border-input-border-color bg-input-color text-question-color rounded-custom mt-2 block w-full border border-solid p-4"
                key={choice.id}>
                {getLocalizedValue(choice.label, defaultLanguageCode)}
              </Section>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Link
                className="border-input-border-color bg-input-color text-question-color rounded-custom mt-2 block border border-solid p-4 hover:bg-slate-100"
                href={`${urlWithPrefilling}${firstQuestion.id}=${getLocalizedValue(choice.label, defaultLanguageCode)}`}
                key={choice.id}>
                {getLocalizedValue(choice.label, defaultLanguageCode)}
              </Link>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.PictureSelection:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {subheader}
          </Text>
          <Section className="mx-0">
            {firstQuestion.choices.map((choice) =>
              firstQuestion.allowMulti ? (
                <Img
                  className="rounded-custom mb-1 mr-1 inline-block h-[140px] w-[220px]"
                  key={choice.id}
                  src={choice.imageUrl}
                />
              ) : (
                <Link
                  className="rounded-custom mb-1 mr-1 inline-block h-[140px] w-[220px]"
                  href={`${urlWithPrefilling}${firstQuestion.id}=${choice.id}`}
                  key={choice.id}
                  target="_blank">
                  <Img className="rounded-custom h-full w-full" src={choice.imageUrl} />
                </Link>
              )
            )}
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Cal:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Container>
            <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
              {headline}
            </Text>
            <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
              {subheader}
            </Text>
            <EmailButton
              className={cn(
                "bg-brand-color rounded-custom mx-auto block w-max cursor-pointer appearance-none px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              {t("emails.schedule_your_meeting")}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Date:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">{subheader}</Text>
          <Section className="border-input-border-color bg-input-color rounded-custom mt-4 flex h-12 w-full items-center justify-center border border-solid">
            <CalendarDaysIcon className="text-question-color inline h-4 w-4" />
            <Text className="text-question-color inline text-sm font-medium">
              {t("emails.select_a_date")}
            </Text>
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Matrix:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {subheader}
          </Text>
          <Container className="mx-0">
            <Section className="w-full table-auto">
              <Row>
                <Column className="w-40 break-words px-4 py-2" />
                {firstQuestion.columns.map((column) => {
                  return (
                    <Column
                      className="text-question-color max-w-40 break-words px-4 py-2 text-center"
                      key={getLocalizedValue(column, "default")}>
                      {getLocalizedValue(column, "default")}
                    </Column>
                  );
                })}
              </Row>
              {firstQuestion.rows.map((row, rowIndex) => {
                return (
                  <Row
                    className={`${rowIndex % 2 === 0 ? "bg-input-color" : ""} rounded-custom`}
                    key={getLocalizedValue(row, "default")}>
                    <Column className="w-40 break-words px-4 py-2">
                      {getLocalizedValue(row, "default")}
                    </Column>
                    {firstQuestion.columns.map((_) => {
                      return (
                        <Column
                          className="text-question-color px-4 py-2"
                          key={getLocalizedValue(_, "default")}>
                          <Section className="bg-card-bg-color h-4 w-4 rounded-full p-2 outline" />
                        </Column>
                      );
                    })}
                  </Row>
                );
              })}
            </Section>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionTypeEnum.Address:
    case TSurveyQuestionTypeEnum.ContactInfo:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">{subheader}</Text>
          {["First Name", "Last Name", "Email", "Phone", "Company"].map((label) => (
            <Section
              className="border-input-border-color bg-input-color rounded-custom mt-4 block h-10 w-full border border-solid py-2 pl-2 text-slate-400"
              key={label}>
              {label}
            </Section>
          ))}
          <EmailFooter />
        </EmailTemplateWrapper>
      );

    case TSurveyQuestionTypeEnum.FileUpload:
      return (
        <EmailTemplateWrapper styling={styling} surveyUrl={url}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {headline}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">{subheader}</Text>
          <Section className="border-input-border-color rounded-custom mt-4 flex h-24 w-full items-center justify-center border border-dashed bg-slate-50">
            <Container className="mx-auto flex items-center text-center">
              <UploadIcon className="mt-6 inline h-5 w-5 text-slate-400" />
              <Text className="text-slate-400">{t("emails.click_or_drag_to_upload_files")}</Text>
            </Container>
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
  }
}

function EmailTemplateWrapper({
  children,
  surveyUrl,
  styling,
}: {
  children: React.ReactNode;
  surveyUrl: string;
  styling: TSurveyStyling;
}): React.JSX.Element {
  let signatureColor = "";
  const colors = {
    "brand-color": styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
    "card-bg-color": styling.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor,
    "input-color": styling.inputColor?.light ?? COLOR_DEFAULTS.inputColor,
    "input-border-color": styling.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor,
    "card-border-color": styling.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor,
    "question-color": styling.questionColor?.light ?? COLOR_DEFAULTS.questionColor,
  };

  if (isLight(colors["question-color"])) {
    signatureColor = mixColor(colors["question-color"], "#000000", 0.2);
  } else {
    signatureColor = mixColor(colors["question-color"], "#ffffff", 0.2);
  }

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              ...colors,
              "signature-color": signatureColor,
            },
            borderRadius: {
              custom: `${(styling.roundness ?? 8).toString()}px`,
            },
          },
        },
      }}>
      <Link
        className="bg-card-bg-color border-card-border-color rounded-custom mx-0 my-2 block overflow-auto border border-solid p-8 font-sans text-inherit"
        href={surveyUrl}
        target="_blank">
        {children}
      </Link>
    </Tailwind>
  );
}

function EmailFooter(): React.JSX.Element {
  return (
    <Container className="m-auto mt-8 text-center">
      <Link className="text-signature-color text-xs" href="https://formbricks.com/" target="_blank">
        Powered by Formbricks
      </Link>
    </Container>
  );
}
