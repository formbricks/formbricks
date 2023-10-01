import toast from "react-hot-toast";
import CodeBlock from "@/components/shared/CodeBlock";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Input, Button } from "@formbricks/ui";
import { DocumentDuplicateIcon, EnvelopeIcon, CodeBracketIcon } from "@heroicons/react/24/solid";
import {
  Section,
  Tailwind,
  render,
  Button as EmailButton,
  Text,
  Link,
  Container,
  Row,
  Column,
} from "@react-email/components";
import { useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { QuestionType } from "@formbricks/types/questions";
import { TProfile } from "@formbricks/types/v1/profile";
import { TProduct } from "@formbricks/types/v1/product";
import { sendEmailAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";

interface EmailTabProps {
  survey: TSurvey;
  surveyUrl: string;
  profile: TProfile;
  product: TProduct;
}

export default function EmailTab({ survey, surveyUrl, profile, product }: EmailTabProps) {
  const [email] = useState(profile.email);
  const [showEmbed, setShowEmbed] = useState(false);
  const brandColor = product.brandColor;
  const subject = "Formbricks Email Survey Preview";

  const emailTemplate = useMemo(() => {
    return getEmailTemplate(survey, surveyUrl);
  }, [survey, surveyUrl]);

  const Email = (
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
      {emailTemplate}
    </Tailwind>
  );

  const emailHtml = render(Email, { pretty: true });
  const emailHtmlWithoutDoctype = emailHtml.replace(
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    ""
  );

  const sendPreviewEmail = async () => {
    const emailPreviewHtml = emailHtmlWithoutDoctype
      .replace(`${surveyUrl}?`, `${surveyUrl}?preview=true&`)
      .replace(`"${surveyUrl}"`, `"${surveyUrl}?preview=true"`);

    await sendEmailAction({ html: emailPreviewHtml, subject, to: email });
    toast.success("Email sent!");
  };
  return (
    <div className="flex h-full grow flex-col gap-5">
      <div className="flex items-center gap-4">
        <Input
          type="email"
          placeholder="user@mail.com"
          className="h-11 grow bg-white"
          value={email}
          onChange={() => {
            // setEmail(e.target.value)
          }}
        />
        {showEmbed ? (
          <Button
            variant="darkCTA"
            title="Embed survey in your website"
            aria-label="Embed survey in your website"
            onClick={() => {
              toast.success("Embed code copied to clipboard!");
              navigator.clipboard.writeText(emailHtmlWithoutDoctype);
            }}
            className="shrink-0"
            EndIcon={DocumentDuplicateIcon}>
            Copy code
          </Button>
        ) : (
          <Button
            variant="secondary"
            title="send preview email"
            aria-label="send preview email"
            onClick={sendPreviewEmail}
            EndIcon={EnvelopeIcon}
            className="shrink-0">
            Send Preview
          </Button>
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
            {emailHtmlWithoutDoctype}
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
              <div className="p-4">{Email}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getEmailTemplate = (survey: TSurvey, surveyUrl: string) => {
  const firstQuestion = survey.questions[0];
  switch (firstQuestion.type) {
    case QuestionType.OpenText:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Text className="m-0 mb-1.5 mr-8 block p-0 text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
            {firstQuestion.subheader}
          </Text>
          <Section className="mt-4 block h-20 w-full rounded-lg border border-solid border-gray-200 bg-slate-50" />
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case QuestionType.Consent:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Container className="m-0 text-sm font-normal leading-6 text-slate-600">
            <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
          </Container>

          <Container className="m-0 mt-4 block w-full max-w-none rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 font-medium text-slate-800">
            <Text className="m-0 inline-block">{firstQuestion.label}</Text>
          </Container>
          <Container className="mx-0 mt-4 flex max-w-none justify-end">
            {!firstQuestion.required && (
              <EmailButton
                href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                Reject
              </EmailButton>
            )}
            <EmailButton
              href={`${surveyUrl}?${firstQuestion.id}=accepted`}
              className="bg-brand-color ml-2 inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-white">
              Accept
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case QuestionType.NPS:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Section>
            <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
              {firstQuestion.headline}
            </Text>
            <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
              {firstQuestion.subheader}
            </Text>
            <Container className="mx-0 mt-4 flex w-max flex-col">
              <Section className="block overflow-hidden rounded-md border border-solid border-gray-200">
                {Array.from({ length: 11 }, (_, i) => (
                  <EmailButton
                    key={i}
                    href={`${surveyUrl}?${firstQuestion.id}=${i}`}
                    className="m-0 inline-flex h-10 w-10 items-center justify-center border border-solid border-gray-200 p-0 text-slate-800">
                    {i}
                  </EmailButton>
                ))}
              </Section>
              <Section className="m-0 px-1.5 text-xs leading-6 text-slate-500">
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
                  href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                  className="mt-4 cursor-pointer appearance-none rounded-md bg-brand-color px-6 py-3 text-sm font-medium text-white">
                  {firstQuestion.buttonLabel || "Skip"}
                </EmailButton>
              )} */}

            <EmailFooter />
          </Section>
        </EmailTemplateWrapper>
      );
    case QuestionType.CTA:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Container className="m-0 text-sm font-normal leading-6 text-slate-600">
            <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
          </Container>

          <Container className="mx-0 mt-4 max-w-none">
            {!firstQuestion.required && (
              <EmailButton
                href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                {firstQuestion.dismissButtonLabel}
              </EmailButton>
            )}
            <EmailButton
              href={`${surveyUrl}?${firstQuestion.id}=clicked`}
              className="bg-brand-color ml-2 inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-white">
              {firstQuestion.buttonLabel}
            </EmailButton>
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case QuestionType.Rating:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Section>
            <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
              {firstQuestion.headline}
            </Text>
            <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
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
                    href={`${surveyUrl}?${firstQuestion.id}=${i + 1}`}
                    className={cn(
                      "m-0 inline-flex h-10 w-10 items-center justify-center p-0 text-slate-800",
                      {
                        ["border border-solid border-gray-200"]: firstQuestion.scale === "number",
                      }
                    )}>
                    {firstQuestion.scale === "smiley" && "😃"}
                    {firstQuestion.scale === "number" && i + 1}
                    {firstQuestion.scale === "star" && "⭐"}
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
                  href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                  className="mt-4 cursor-pointer appearance-none rounded-md bg-brand-color px-6 py-3 text-sm font-medium text-white">
                  {firstQuestion.buttonLabel || "Skip"}
                </EmailButton>
              )} */}
            <EmailFooter />
          </Section>
        </EmailTemplateWrapper>
      );
    case QuestionType.MultipleChoiceMulti:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Text className="m-0 mb-1.5 mr-8 block p-0 text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
            {firstQuestion.subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices.map((choice) => (
              <Section
                className="mt-4 block w-full rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 text-slate-800"
                key={choice.id}>
                {choice.label}
              </Section>
            ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
    case QuestionType.MultipleChoiceSingle:
      return (
        <EmailTemplateWrapper surveyUrl={surveyUrl}>
          <Text className="m-0 mb-1.5 mr-8 block p-0 text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
            {firstQuestion.subheader}
          </Text>
          <Container className="mx-0 max-w-none">
            {firstQuestion.choices
              .filter((c) => c.id !== "other")
              .map((choice) => (
                <Link
                  key={choice.id}
                  className="mt-4 block rounded-lg border border-solid border-gray-200 bg-slate-50 p-4 text-slate-800"
                  href={`${surveyUrl}?${firstQuestion.id}=${choice.label}`}>
                  {choice.label}
                </Link>
              ))}
          </Container>
          <EmailFooter />
        </EmailTemplateWrapper>
      );
  }
};

const EmailTemplateWrapper = ({ children, surveyUrl }) => {
  return (
    <Link
      href={surveyUrl}
      target="_blank"
      className="mx-0 my-2 block rounded-lg border border-solid border-black bg-white px-4 py-2 font-sans text-inherit">
      {children}
    </Link>
  );
};

const EmailFooter = () => {
  return (
    <Container className="m-auto mt-4 text-center">
      <Text className="m-0 inline-block p-0 text-xs text-slate-400">Powered by</Text>
      <Link
        href="https://formbricks.com/"
        target="_blank"
        className="m-0 ml-1 inline-block p-0 text-sm text-slate-700">
        Formbricks
      </Link>
    </Container>
  );
};
