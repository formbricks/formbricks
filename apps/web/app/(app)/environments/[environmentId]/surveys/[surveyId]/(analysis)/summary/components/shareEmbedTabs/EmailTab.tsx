"use client";

import { cn } from "@formbricks/lib/cn";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { TSurveyQuestionType } from "@formbricks/types/surveys";
import { TSurvey } from "@formbricks/types/surveys";
import { AuthenticationError } from "@formbricks/types/errors";
import { sendEmailAction } from "../../actions";
import CodeBlock from "@formbricks/ui/CodeBlock";
import { CodeBracketIcon, DocumentDuplicateIcon, EnvelopeIcon } from "@heroicons/react/24/solid";
import {
  Column,
  Container,
  Button as EmailButton,
  Link,
  Row,
  Section,
  Tailwind,
  Text,
  render,
  Img,
} from "@react-email/components";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { isLight } from "@/app/lib/utils";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";

interface EmailTabProps {
  survey: TSurvey;
  surveyUrl: string;
  email: string;
  brandColor: string;
}

export default function EmailTab({ survey, surveyUrl, email, brandColor }: EmailTabProps) {
  const [showEmbed, setShowEmbed] = useState(false);
  const subject = "Formbricks Email Survey Preview";

  const emailValues = useMemo(() => {
    return getEmailValues({ brandColor, survey, surveyUrl, preview: false });
  }, []);

  const previewEmailValues = useMemo(() => {
    return getEmailValues({ brandColor, survey, surveyUrl, preview: true });
  }, []);

  const sendPreviewEmail = async () => {
    try {
      await sendEmailAction({ html: previewEmailValues.html, subject, to: email });
      toast.success("Email sent!");
    } catch (err) {
      if (err instanceof AuthenticationError) {
        toast.error("You are not authenticated to perform this action.");
        return;
      }

      toast.error("Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="flex h-full grow flex-col gap-5">
      <div className="flex items-center justify-end gap-4">
        {showEmbed ? (
          <Button
            variant="darkCTA"
            title="Embed survey in your website"
            aria-label="Embed survey in your website"
            onClick={() => {
              toast.success("Embed code copied to clipboard!");
              navigator.clipboard.writeText(emailValues.html);
            }}
            className="shrink-0"
            EndIcon={DocumentDuplicateIcon}>
            Copy code
          </Button>
        ) : (
          <>
            <Input type="email" placeholder="user@mail.com" className="h-11 grow bg-white" value={email} />
            <Button
              variant="secondary"
              title="send preview email"
              aria-label="send preview email"
              onClick={sendPreviewEmail}
              EndIcon={EnvelopeIcon}
              className="shrink-0">
              Send Preview
            </Button>
          </>
        )}
        <Button
          variant="darkCTA"
          title="view embed code for email"
          aria-label="view embed code for email"
          onClick={() => setShowEmbed(!showEmbed)}
          EndIcon={CodeBracketIcon}
          className="shrink-0">
          {showEmbed ? "Hide Embed Code" : "View Embed Code"}
        </Button>
      </div>
      <div className="grow overflow-y-scroll rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        {showEmbed ? (
          <CodeBlock
            customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
            language="html"
            showCopyToClipboard={false}>
            {emailValues.html}
          </CodeBlock>
        ) : (
          <div className="">
            <div className="mb-6 flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="">
              <div className="mb-2 border-b border-slate-200 pb-2 text-sm">
                To : {email || "user@mail.com"}
              </div>
              <div className="border-b border-slate-200 pb-2 text-sm">Subject : {subject}</div>
              <div className="p-4">{previewEmailValues.Component}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getEmailValues = ({ survey, surveyUrl, brandColor, preview }) => {
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

  const Template = getEmailTemplate(survey, surveyUrl, brandColor, preview);
  const html = render(Template, { pretty: true });
  const htmlWithoutDoctype = html.replace(doctype, "");

  return { Component: Template, html: htmlWithoutDoctype };
};

const getEmailTemplate = (survey: TSurvey, surveyUrl: string, brandColor: string, preview: boolean) => {
  const url = preview ? `${surveyUrl}?preview=true` : surveyUrl;
  const urlWithPrefilling = preview ? `${surveyUrl}?preview=true&` : `${surveyUrl}?`;

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
            {/* {!firstQuestion.required && (
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
              className={cn(
                "bg-brand-color mt-4 cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              {firstQuestion.buttonLabel || "Skip"}
            </EmailButton>
          )} */}

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
            {/* {!firstQuestion.required && (
            <EmailButton
              href={`${urlWithPrefilling}${firstQuestion.id}=dismissed`}
              className={cn(
                "bg-brand-color mt-4 cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium",
                isLight(brandColor) ? "text-black" : "text-white"
              )}>
              {firstQuestion.buttonLabel || "Skip"}
            </EmailButton>
          )} */}
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
    case TSurveyQuestionType.FileUpload:
      return (
        <EmailTemplateWrapper surveyUrl={url} brandColor={brandColor}>
          <Text className="m-0 mr-8 block p-0 text-base font-semibold leading-6 text-slate-800">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 mb-2 block p-0 text-sm font-normal leading-6 text-slate-500">
            {firstQuestion.subheader}
          </Text>
          <Section className="mx-0">
            <Section className="mt-4 flex h-20 w-full items-center justify-center rounded-lg border border-solid border-gray-200 bg-slate-50">
              <div className="flex flex-col items-center justify-center gap-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-6 text-center text-slate-500">
                  <path
                    fillRule="evenodd"
                    d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-500">
                  Click or drag to upload files.
                </Text>
              </div>
            </Section>
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
