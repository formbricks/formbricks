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
import { CalendarDaysIcon } from "lucide-react";
import React from "react";

import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { isLight, mixColor } from "@formbricks/lib/utils";
import { TSurvey, TSurveyQuestionType, TSurveyStyling } from "@formbricks/types/surveys";
import { RatingSmiley } from "@formbricks/ui/RatingSmiley";

interface PreviewEmailTemplateProps {
  survey: TSurvey;
  surveyUrl: string;
  styling: TSurveyStyling;
}

export const getPreviewEmailTemplateHtml = (survey: TSurvey, surveyUrl: string, styling: TSurveyStyling) => {
  return render(<PreviewEmailTemplate survey={survey} surveyUrl={surveyUrl} styling={styling} />, {
    pretty: true,
  });
};

export const PreviewEmailTemplate = ({ survey, surveyUrl, styling }: PreviewEmailTemplateProps) => {
  const url = `${surveyUrl}?preview=true`;
  const urlWithPrefilling = `${surveyUrl}?preview=true&`;
  const defaultLanguageCode = "default";
  const firstQuestion = survey.questions[0];

  const brandColor = styling?.brandColor?.light || COLOR_DEFAULTS.brandColor;

  switch (firstQuestion.type) {
    case TSurveyQuestionType.OpenText:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
          </Text>
          <Section className="border-input-border-color rounded-custom mt-4 block h-20 w-full border border-solid bg-slate-50" />
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Consent:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 block text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Container className="text-question-color m-0 text-sm font-normal leading-6">
            <Text
              className="m-0 p-0"
              dangerouslySetInnerHTML={{
                __html: getLocalizedValue(firstQuestion.html, defaultLanguageCode) || "",
              }}></Text>
          </Container>

          <Container className="border-input-border-color bg-input-color rounded-custom m-0 mt-4 block w-full max-w-none border border-solid p-4 font-medium text-slate-800">
            <Text className="text-question-color m-0 inline-block">
              {getLocalizedValue(firstQuestion.label, defaultLanguageCode)}
            </Text>
          </Container>
          <Container className="mx-0 mt-4 flex max-w-none justify-end">
            {!firstQuestion.required && (
              <EmailButton
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
                className="rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium text-black">
                Reject
              </EmailButton>
            )}
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=accepted`}
              className={cn(
                "bg-brand-color rounded-custom ml-2 inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              Accept
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.NPS:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Section>
            <Text className="text-question-color m-0 block text-base font-semibold leading-6">
              {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
            </Text>
            <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
              {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
            </Text>
            <Container className="mx-0 mt-4 flex w-max flex-col">
              <Section className="border-input-border-color rounded-custom block overflow-hidden border">
                {Array.from({ length: 11 }, (_, i) => (
                  <EmailButton
                    key={i}
                    href={`${urlWithPrefilling}${firstQuestion.id}=${i}`}
                    className="border-input-border-color m-0 inline-flex h-10 w-10 items-center justify-center border p-0 text-slate-800">
                    {i}
                  </EmailButton>
                ))}
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
    case TSurveyQuestionType.CTA:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color  m-0 block text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Container className="text-question-color ml-0 mt-2 text-sm font-normal leading-6">
            <Text
              className="m-0 p-0"
              dangerouslySetInnerHTML={{
                __html: getLocalizedValue(firstQuestion.html, defaultLanguageCode) || "",
              }}></Text>
          </Container>

          <Container className="mx-0 mt-4 max-w-none">
            {!firstQuestion.required && (
              <EmailButton
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
                className="rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium text-black">
                {getLocalizedValue(firstQuestion.dismissButtonLabel, defaultLanguageCode) || "Skip"}
              </EmailButton>
            )}
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=clicked`}
              className={cn(
                "bg-brand-color rounded-custom inline-flex cursor-pointer appearance-none px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              {getLocalizedValue(firstQuestion.buttonLabel, defaultLanguageCode)}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Rating:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Section className="w-full">
            <Text className="text-question-color m-0 block text-base font-semibold leading-6">
              {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
            </Text>
            <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
              {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
            </Text>
            <Container className="mx-0 mt-4 w-full items-center justify-center">
              <Section
                className={cn("rounded-custom w-full overflow-hidden", {
                  ["border border-solid border-gray-200"]: firstQuestion.scale === "number",
                })}>
                <Column className="mb-4 flex w-full justify-around">
                  {Array.from({ length: firstQuestion.range }, (_, i) => (
                    <EmailButton
                      key={i}
                      href={`${urlWithPrefilling}${firstQuestion.id}=${i + 1}`}
                      className={cn(
                        "m-0 h-10 w-full p-0 text-center align-middle leading-10 text-slate-800",
                        {
                          ["border border-solid border-gray-200"]: firstQuestion.scale === "number",
                        }
                      )}>
                      {firstQuestion.scale === "smiley" && (
                        <RatingSmiley active={false} idx={i} range={firstQuestion.range} />
                      )}
                      {firstQuestion.scale === "number" && (
                        <Text className="m-0 flex h-10 items-center">{i + 1}</Text>
                      )}
                      {firstQuestion.scale === "star" && <Text className="text-3xl">⭐</Text>}
                    </EmailButton>
                  ))}
                </Column>
              </Section>
              <Section className="text-question-color m-0 px-1.5 text-xs leading-6">
                <Row>
                  <Column>
                    <Text className="m-0 inline-block p-0">
                      {getLocalizedValue(firstQuestion.lowerLabel, defaultLanguageCode)}
                    </Text>
                  </Column>
                  <Column className="text-right">
                    <Text className="m-0 inline-block  p-0 text-right">
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
    case TSurveyQuestionType.MultipleChoiceMulti:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
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
    case TSurveyQuestionType.MultipleChoiceSingle:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Link
                key={choice.id}
                className="border-input-border-color bg-input-color text-question-color rounded-custom mt-2 block border border-solid p-4 hover:bg-slate-100"
                href={`${urlWithPrefilling}${firstQuestion.id}=${getLocalizedValue(choice.label, defaultLanguageCode)}`}>
                {getLocalizedValue(choice.label, defaultLanguageCode)}
              </Link>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.PictureSelection:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
          </Text>
          <Section className="mx-0">
            {firstQuestion.choices.map((choice) =>
              firstQuestion.allowMulti ? (
                <Img
                  src={choice.imageUrl}
                  className="rounded-custom mb-1 mr-1 inline-block h-[110px] w-[220px]"
                />
              ) : (
                <Link
                  href={`${urlWithPrefilling}${firstQuestion.id}=${choice.id}`}
                  target="_blank"
                  className="rounded-custom mb-1 mr-1 inline-block h-[110px] w-[220px]">
                  <Img src={choice.imageUrl} className="rounded-custom h-full w-full" />
                </Link>
              )
            )}
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Cal:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Container>
            <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
              {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
            </Text>
            <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
              You have been invited to schedule a meet via cal.com.
            </Text>
            <EmailButton
              className={cn(
                "bg-brand-color rounded-custom mx-auto block w-max cursor-pointer appearance-none px-6 py-3 text-sm font-medium ",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              Schedule your meeting
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Date:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
          </Text>
          <Section className="border-input-border-color bg-input-color rounded-custom mt-4 flex h-12 w-full items-center justify-center border border-solid">
            <CalendarDaysIcon className="text-question-color inline h-4 w-4" />
            <Text className="text-question-color inline text-sm font-medium">Select a date</Text>
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Matrix:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, "default")}
          </Text>
          <Text className="text-question-color m-0 mb-2 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, "default")}
          </Text>
          <Container className="mx-0">
            <Section className="w-full table-auto">
              <Row>
                <Column className="w-40 break-words px-4 py-2"></Column>
                {firstQuestion.columns.map((column, columnIndex) => {
                  return (
                    <Column
                      key={columnIndex}
                      className="text-question-color max-w-40 break-words px-4 py-2 text-center">
                      {getLocalizedValue(column, "default")}
                    </Column>
                  );
                })}
              </Row>
              {firstQuestion.rows.map((row, rowIndex) => {
                return (
                  <Row
                    key={rowIndex}
                    className={`${rowIndex % 2 === 0 ? "bg-input-color" : ""} rounded-custom`}>
                    <Column className="w-40 break-words px-4 py-2">
                      {getLocalizedValue(row, "default")}
                    </Column>
                    {firstQuestion.columns.map(() => {
                      return (
                        <Column className="text-question-color px-4 py-2">
                          <Section className="bg-card-bg-color h-4 w-4 rounded-full p-2 outline"></Section>
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
    case TSurveyQuestionType.Address:
      return (
        <EmailTemplateWrapper surveyUrl={url} styling={styling}>
          <Text className="text-question-color m-0 mr-8 block p-0 text-base font-semibold leading-6">
            {getLocalizedValue(firstQuestion.headline, defaultLanguageCode)}
          </Text>
          <Text className="text-question-color m-0 block p-0 text-sm font-normal leading-6">
            {getLocalizedValue(firstQuestion.subheader, defaultLanguageCode)}
          </Text>
          {Array.from({ length: 6 }).map((_, index) => (
            <Section
              key={index}
              className="border-input-border-color bg-input-color rounded-custom mt-4 block h-10 w-full border border-solid"
            />
          ))}
          <EmailFooter />
        </EmailTemplateWrapper>
      );
  }
};

const EmailTemplateWrapper = ({
  children,
  surveyUrl,
  styling,
}: {
  children: React.ReactNode;
  surveyUrl: string;
  styling: TSurveyStyling;
}) => {
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
              custom: styling.roundness ?? 8,
            },
          },
        },
      }}>
      <Link
        href={surveyUrl}
        target="_blank"
        className="bg-card-bg-color border-card-border-color rounded-custom mx-0 my-2 block overflow-auto border border-solid p-8 font-sans text-inherit">
        {children}
      </Link>
    </Tailwind>
  );
};

const EmailFooter = () => {
  return (
    <Container className="m-auto mt-8 text-center">
      <Link href="https://formbricks.com/" target="_blank" className="text-signature-color text-xs">
        Powered by Formbricks
      </Link>
    </Container>
  );
};
