"use client";

import toast from "react-hot-toast";
import CodeBlock from "@/components/shared/CodeBlock";
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
import { useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogContent, Input } from "@formbricks/ui";
import { TSurvey } from "@formbricks/types/v1/surveys";
import {
  LinkIcon,
  EnvelopeIcon,
  CodeBracketIcon,
  DocumentDuplicateIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@formbricks/lib/cn";
import { QuestionType } from "@formbricks/types/questions";

interface EmbedSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyBaseUrl: string;
}

const tabs = [
  { id: "link", label: "Share the Link", icon: LinkIcon },
  { id: "email", label: "Embed in an Email", icon: EnvelopeIcon },
  { id: "webpage", label: "Embed in a Web Page", icon: CodeBracketIcon },
];

export default function EmbedSurveyModal({ survey, open, setOpen, surveyBaseUrl }: EmbedSurveyModalProps) {
  const [activeId, setActiveId] = useState(tabs[0].id);

  const surveyUrl = useMemo(() => surveyBaseUrl + survey.id, [survey]);

  const componentMap = {
    link: <LinkTab surveyUrl={surveyUrl} />,
    email: <EmailTab survey={survey} surveyUrl={surveyUrl} />,
    webpage: <WebpageTab surveyUrl={surveyUrl} />,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[960px] gap-0 overflow-hidden bg-white p-0 sm:max-w-[auto]">
        <div className="border-b border-gray-200 px-6 py-4 ">Share or embed your survey</div>
        <div className="flex">
          <div className="shrink-0 basis-[326px] border-r border-gray-200 px-6 py-8">
            <div className="flex w-max flex-col gap-3">
              {tabs.map((tab) => (
                <Button
                  StartIcon={tab.icon}
                  startIconClassName={cn("h-4 w-4")}
                  variant="minimal"
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  className={cn(
                    "rounded-[4px] px-4 py-[6px] text-slate-600",
                    // "focus:ring-0 focus:ring-offset-0", // enable these classes to remove the focus rings on buttons
                    tab.id === activeId
                      ? " border border-gray-200 bg-slate-100 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                  aria-current={tab.id === activeId ? "page" : undefined}>
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex h-[590px] grow bg-gray-50 p-6">{componentMap[activeId]}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LinkTab = ({ surveyUrl }) => {
  const linkTextRef = useRef(null);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <div className="flex grow flex-col gap-5">
      <div className="flex justify-between gap-2">
        <div
          ref={linkTextRef}
          className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-slate-800"
          onClick={() => handleTextSelection()}>
          <span style={{ wordBreak: "break-all" }}>{surveyUrl}</span>
        </div>
        <Button
          variant="darkCTA"
          title="Copy survey link to clipboard"
          aria-label="Copy survey link to clipboard"
          onClick={() => {
            navigator.clipboard.writeText(surveyUrl);
            toast.success("URL copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy URL
        </Button>
      </div>
      <div className="relative grow rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        <Button
          variant="minimal"
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 transform rounded-lg border border-slate-200"
          )}
          EndIcon={ArrowUpRightIcon}
          title="Open survey in new tab"
          aria-label="Open survey in new tab"
          endIconClassName="h-4 w-4 "
          href={`${surveyUrl}?preview=true`}
          target="_blank">
          Open in new tab
        </Button>
      </div>
    </div>
  );
};

const EmailTab = ({ survey, surveyUrl }: { survey: TSurvey; surveyUrl: string }) => {
  const [email, setEmail] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);

  console.log(survey);
  const Email = (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              "brand-dark": "#00C4B8",
            },
          },
        },
      }}>
      {getEmailTemplate(survey, surveyUrl)}
    </Tailwind>
  );

  const confirmEmail = render(Email, { pretty: true });

  return (
    <div className="flex grow flex-col gap-5">
      <div className="flex items-center gap-4">
        <Input
          type="email"
          placeholder="user@mail.com"
          className="h-11 grow bg-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {showEmbed ? (
          <Button
            variant="darkCTA"
            title="Embed survey in your website"
            aria-label="Embed survey in your website"
            onClick={() => {
              toast.success("Embed code copied to clipboard!");
            }}
            className="shrink-0"
            EndIcon={DocumentDuplicateIcon}>
            Copy code
          </Button>
        ) : (
          <Button
            variant="secondary"
            title="view embed code for email"
            aria-label="view embed code for email"
            onClick={() => {}}
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
          <>
            <CodeBlock
              customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
              language="html"
              showCopyToClipboard={false}>
              {confirmEmail}
            </CodeBlock>
          </>
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
              <div className="border-b border-slate-200 pb-2 text-sm">
                Subject : Formbricks Email Survey Preview
              </div>
              <div className="p-4">{Email}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const WebpageTab = ({ surveyUrl }) => {
  const iframeCode = `<div style="position: relative; height:100vh; max-height:100vh; overflow:auto;"> 
  <iframe 
  src="${surveyUrl}" 
  frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">
  </iframe>
  </div>`;

  return (
    <div className="flex grow flex-col gap-5">
      <div className="flex justify-between">
        <div className=""></div>
        <Button
          variant="darkCTA"
          title="Embed survey in your website"
          aria-label="Embed survey in your website"
          onClick={() => {
            navigator.clipboard.writeText(iframeCode);
            toast.success("Embed code copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy code
        </Button>
      </div>
      <div className="grow overflow-y-scroll rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        <CodeBlock
          customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
          language="html"
          showCopyToClipboard={false}>
          {iframeCode}
        </CodeBlock>
      </div>
    </div>
  );
};

const getEmailTemplate = (survey: TSurvey, surveyUrl: string) => {
  const firstQuestion = survey.questions[0];
  console.log(firstQuestion);
  switch (firstQuestion.type) {
    case QuestionType.OpenText:
      return (
        <Link
          href={surveyUrl}
          target="_blank"
          className="mx-0 my-2 block rounded-lg border border-black px-4 py-2 text-inherit">
          <Text className="m-0 mb-1.5 mr-8 block p-0 text-base font-semibold leading-6 text-slate-900">
            {firstQuestion.headline}
          </Text>
          <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
            {firstQuestion.subheader}
          </Text>
          <Section className="mt-4 block h-20 w-full rounded-lg border border-gray-200 bg-slate-50" />
          <Container className="m-auto mt-4 text-center">
            <Text className="m-0 inline-block p-0 text-xs text-slate-400">powered by</Text>
            <Text className="m-0 ml-1 inline-block p-0 text-slate-700">Formbricks</Text>
          </Container>
        </Link>
      );
    case QuestionType.Consent:
      return (
        <Link href={surveyUrl} target="_blank">
          <Section className="block rounded-lg border border-black px-4 py-2 text-inherit">
            <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
              {firstQuestion.headline}
            </Text>
            <Container className="m-0 text-sm font-normal leading-6 text-slate-600">
              <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
            </Container>

            <Container className="mt-4 block w-full rounded-lg border border-gray-200 bg-slate-50 p-4 font-medium text-slate-800">
              <Text className="m-0 inline-block">{firstQuestion.label}</Text>
            </Container>
            <Container className="mt-4 flex justify-end">
              {!firstQuestion.required && (
                <EmailButton
                  href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                  className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                  Reject
                </EmailButton>
              )}
              <EmailButton
                href={`${surveyUrl}?${firstQuestion.id}=accepted`}
                className="bg-brand-dark ml-2 inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-white">
                Accept
              </EmailButton>
            </Container>
            <Container className="m-auto mt-4 text-center">
              <Text className="m-0 inline-block p-0 text-xs text-slate-400">powered by</Text>
              <Text className="m-0 ml-1 inline-block p-0 text-slate-700">Formbricks</Text>
            </Container>
          </Section>
        </Link>
      );
    case QuestionType.NPS:
      return (
        <Link href={surveyUrl} target="_blank">
          <Section className="block rounded-lg border border-black px-4 py-2 text-inherit">
            <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
              {firstQuestion.headline}
            </Text>
            <Text className="m-0 block p-0 text-sm font-normal leading-6 text-slate-600">
              {firstQuestion.subheader}
            </Text>
            <Container className="mx-0 mt-4 flex w-max flex-col ">
              <Section className="block overflow-hidden rounded-md border">
                {Array.from({ length: 11 }, (_, i) => (
                  <EmailButton
                    href={`${surveyUrl}?${firstQuestion.id}=${i}`}
                    className="m-0 inline-flex h-10 w-10 items-center justify-center border p-0 text-slate-800">
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

            <Container className="m-auto mt-4 text-center">
              <Text className="m-0 inline-block p-0 text-xs text-slate-400">powered by</Text>
              <Text className="m-0 ml-1 inline-block p-0 text-slate-700">Formbricks</Text>
            </Container>
          </Section>
        </Link>
      );
    case QuestionType.CTA:
      return (
        <Link href={surveyUrl} target="_blank">
          <Section className="block rounded-lg border border-black px-4 py-2 text-inherit">
            <Text className="m-0 mb-1.5 block text-base font-semibold leading-6 text-slate-900">
              {firstQuestion.headline}
            </Text>
            <Container className="m-0 text-sm font-normal leading-6 text-slate-600">
              <Text className="m-0 p-0" dangerouslySetInnerHTML={{ __html: firstQuestion.html || "" }}></Text>
            </Container>

            <Container className="mt-4 ">
              {!firstQuestion.required && (
                <EmailButton
                  href={`${surveyUrl}?${firstQuestion.id}=dismissed`}
                  className="inline-flex cursor-pointer appearance-none rounded-md px-6 py-3 text-sm font-medium text-black">
                  {firstQuestion.dismissButtonLabel}
                </EmailButton>
              )}
              <EmailButton
                onClick={() => {
                  if (firstQuestion.buttonExternal && firstQuestion.buttonUrl) {
                    window?.open(firstQuestion.buttonUrl, "_blank")?.focus();
                  }
                }}
                href={`${surveyUrl}?${firstQuestion.id}=clicked`}
                className="ml-2 inline-flex cursor-pointer appearance-none rounded-md bg-slate-500 px-6 py-3 text-sm font-medium text-white">
                {firstQuestion.buttonLabel}
              </EmailButton>
            </Container>
            <Container className="m-auto mt-4 text-center">
              <Text className="m-0 inline-block p-0 text-xs text-slate-400">powered by</Text>
              <Text className="m-0 ml-1 inline-block p-0 text-slate-700">Formbricks</Text>
            </Container>
          </Section>
        </Link>
      );
  }
  return <></>;
};
