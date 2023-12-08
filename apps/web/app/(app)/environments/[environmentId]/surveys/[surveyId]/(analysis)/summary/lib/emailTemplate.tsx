import { cn } from "@formbricks/lib/cn";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";

import { isLight } from "@/app/lib/utils";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurvey } from "@formbricks/lib/survey/service";
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

interface EmailTemplateProps {
  survey: TSurvey;
  surveyUrl: string;
  brandColor: string;
}

export const getEmailTemplateHtml = async (surveyId) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }
  const brandColor = product.brandColor;
  const surveyUrl = WEBAPP_URL + "/s/" + survey.id;
  const html = render(<EmailTemplate survey={survey} surveyUrl={surveyUrl} brandColor={brandColor} />, {
    pretty: true,
  });
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  const htmlCleaned = html.toString().replace(doctype, "");

  return htmlCleaned;
};

const EmailTemplate = ({ survey, surveyUrl, brandColor }: EmailTemplateProps) => {
  const url = `${surveyUrl}?preview=true`;
  const urlWithPrefilling = `${surveyUrl}?preview=true&`;

  const firstQuestion = survey.questions[0];
  switch (firstQuestion.type) {
    case TSurveyQuestionType.OpenText:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Section className="mt-4 block h-20 w-full rounded-lg border border-solid border-gray-200 bg-slate-50" />
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Consent:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 block text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Container className="m-0 text-sm font-normal leading-6 text-slate-500">
            <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
          </Container>

          <Container className="m-0 mt-4 block w-full max-w-none rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 font-medium text-slate-800">
            <Text className="m-0 inline-block">{firstQuestion.label}</Text>
          </Container>
          <Container className="mx-0 mt-4 flex max-w-none justify-end">
            {!firstQuestion.required && (
              <EmailButton
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
                className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                Reject
              </EmailButton>
            )}
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=accepted`}
              className={cn(
                "bg-brand-color ml-2 inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium",
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
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Section>
            <Text className="m-0 block text-base font-semibold leading-6 text-slate-800">
              {firstQuestion.headline}
            </Text>
            <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-500">
              {firstQuestion.subheader}
            </Text>
            <Container className="mx-0 mt-4 flex w-max flex-col">
              <Section className="block overflow-hidden rounded-md border border-gray-200">
                {Array.from({ length: 11 }, (_, i) => (
                  <EmailButton
                    key={i}
                    href={`${urlWithPrefilling}${firstQuestion.id}=${i}`}
                    className="m-0 inline-flex h-10 w-10 items-center justify-center  border-gray-200 p-0 text-slate-800">
                    {i}
                  </EmailButton>
                ))}
              </Section>
              <Section className="mt-2 px-1.5 text-xs leading-6 text-slate-500">
                <Row>
                  <Column>
                    <Text className="m-0 inline-block w-max p-0">{firstQuestion.lowerLabel}</Text>
                  </Column>
                  <Column className="text-right">
                    <Text className="m-0 inline-block w-max p-0 text-right">{firstQuestion.upperLabel}</Text>
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
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0  block text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Container className="mt-2 text-sm font-normal leading-6 text-slate-500">
            <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
          </Container>

          <Container className="mx-0 mt-4 max-w-none">
            {!firstQuestion.required && (
              <EmailButton
                href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
                className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                {firstQuestion.dismissButtonLabel || "Skip"}
              </EmailButton>
            )}
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=clicked`}
              className={cn(
                "bg-brand-color inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              {firstQuestion.buttonLabel}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Rating:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Section>
            <Text className="m-0  block text-base font-semibold leading-6 text-slate-800">
              {firstQuestion.headline}
            </Text>
            <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-500">
              {firstQuestion.subheader}
            </Text>
            <Container className="mx-0 mt-4 flex">
              <Section
                className={cn("inline-block w-max overflow-hidden rounded-md", {
                  ["border border-solid border-gray-200"]: firstQuestion.scale === "number",
                })}>
                {Array.from({ length: firstQuestion.range }, (_, i) => (
                  <EmailButton
                    key={i}
                    href={`${urlWithPrefilling}${firstQuestion.id}=${i + 1}`}
                    className={cn(
                      "m-0 inline-flex h-16 w-16 items-center justify-center p-0 text-slate-800",
                      {
                        ["border border-solid border-gray-200"]: firstQuestion.scale === "number",
                      }
                    )}>
                    {firstQuestion.scale === "smiley" && <Text className="text-3xl">😃</Text>}
                    {firstQuestion.scale === "number" && i + 1}
                    {firstQuestion.scale === "star" && <Text className="text-3xl">⭐</Text>}
                  </EmailButton>
                ))}
              </Section>
              <Section className="m-0 px-1.5 text-xs leading-6 text-slate-500">
                <Row>
                  <Column>
                    <Text className="m-0 inline-block p-0">{firstQuestion.lowerLabel}</Text>
                  </Column>
                  <Column className="text-right">
                    <Text className="m-0 inline-block  p-0 text-right">{firstQuestion.upperLabel}</Text>
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
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 mb-2 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section
                className="mt-2 block w-full rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 text-slate-800"
                key={choice.id}>
                {choice.label}
              </Section>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.MultipleChoiceSingle:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 mb-2 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices
              .filter((choice) => choice.id !== "other")
              .map((choice) => (
                <Link
                  key={choice.id}
                  className="mt-2 block rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 text-slate-800 hover:bg-slate-100"
                  href={`${urlWithPrefilling}${firstQuestion.id}=${choice.label}`}>
                  {choice.label}
                </Link>
              ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.PictureSelection:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 mb-2 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Section className="mx-0">
            {firstQuestion.choices.map((choice) =>
              firstQuestion.allowMulti ? (
                <Img
                  src={choice.imageUrl}
                  className="mb-1 mr-1 inline-block h-[110px] w-[220px] rounded-lg"
                />
              ) : (
                <Link
                  href={`${urlWithPrefilling}${firstQuestion.id}=${choice.id}`}
                  target="_blank"
                  className="mb-1 mr-1 inline-block h-[110px] w-[220px] rounded-lg">
                  <Img src={choice.imageUrl} className="h-full w-full rounded-lg" />
                </Link>
              )
            )}
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case TSurveyQuestionType.Date:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Section className="mt-4 flex h-12 w-full items-center justify-center rounded-lg border border-solid border-gray-200 bg-white">
            <CalendarDaysIcon className="mb-1 inline h-4 w-4" />
            <Text className="inline text-sm font-medium">Select a date</Text>
          </Section>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
  }
};

const EmailTemplateWrapper = ({ children, surveyUrl, brandColor }) => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              "brand-color": brandColor,
            },
          },
        },
      }}>
      <Link
        href={surveyUrl}
        target="_blank"
        className="mx-0 my-2 block rounded-lg border border-solid border-slate-300 bg-white p-8 font-sans text-inherit">
        {children}
      </Link>
    </Tailwind>
  );
};

const EmailFooter = () => {
  return (
    <Container className="m-auto mt-8 text-center ">
      <Link href="https://formbricks.com/" target="_blank" className="text-xs text-slate-400">
        Powered by Formbricks
      </Link>
    </Container>
  );
};
