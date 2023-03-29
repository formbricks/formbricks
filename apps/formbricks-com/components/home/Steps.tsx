import DashboardMockupDark from "@/images/dashboard-mockup-dark.png";
import DashboardMockup from "@/images/dashboard-mockup.png";
import PreviewSurvey from "../dummyUI/PreviewSurvey";
import { Button } from "@formbricks/ui";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useState } from "react";
import AddNoCodeEventModalDummy from "../dummyUI/AddNoCodeEventModalDummy";
import HeadingCentered from "../shared/HeadingCentered";
import SetupTabs from "./SetupTabs";
import type { Question } from "../dummyUI/questionTypes";
import AddEventDummy from "../dummyUI/AddEventDummy";

const questions: Question[] = [
  {
    id: "1",
    type: "multipleChoiceSingle",
    headline: "How disappointed would you be if you could no longer use Formbricks?",
    subheader: "Please select one of the following options:",
    required: true,
    choices: [
      {
        id: "2",
        label: "Not at all disappointed",
      },
      {
        id: "3",
        label: "Somewhat disappointed",
      },
      {
        id: "4",
        label: "Very disappointed",
      },
    ],
  },
  {
    id: "5",
    type: "multipleChoiceSingle",
    headline: "What is your role?",
    subheader: "Please select one of the following options:",
    required: true,
    choices: [
      {
        id: "6",
        label: "Founder",
      },
      {
        id: "7",
        label: "Executive",
      },
      {
        id: "8",
        label: "Product Manager",
      },
      {
        id: "9",
        label: "Product Owner",
      },
      {
        id: "10",
        label: "Software Engineer",
      },
    ],
  },
  {
    id: "11",
    type: "openText",
    headline: "How can we improve Formbricks for you?",
    subheader: "Please be as specific as possible.",
    required: true,
  },
];

export default function Steps() {
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);

  return (
    <>
      <HeadingCentered
        closer
        teaser="Leave your engineers in peace"
        heading="Set Formbricks up in minutes"
        subheading="Formbricks is designed for as little dev attention as possible. Here’s how:"
      />
      <div id="howitworks" className="mx-auto mb-12 mt-16 max-w-lg md:mt-8 md:mb-0 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 sm:pl-10 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 1</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                Copy + Paste
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Simply copy a &lt;script&gt; tag to your HTML head - that’s about it. Or use NPM to install
                Formbricks for React, Vue, Svelte, etc.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800">
              <SetupTabs />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last w-full rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:py-8 md:order-first">
              <div className="flex h-40 items-center justify-center">
                <Button
                  variant="primary"
                  className="animate-bounce transition-all duration-150 hover:scale-105"
                  onClick={() => {
                    setAddEventModalOpen(true);
                  }}>
                  <CursorArrowRaysIcon className="mr-2 h-5 w-5 text-white" />
                  Add No-Code Event
                </Button>
              </div>
            </div>
            <div className="pb-8 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 2</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Setup No-Code events
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Set up an event which can trigger your survey - without writing a single line of code. Surveys
                can be triggered on specific pages or after an element is clicked.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 sm:pl-10 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 3</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
                Create your survey
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Start from a template - or from scratch. Ask what you want, in any language. You can also
                adjust the look and feel of your survey.
              </p>
            </div>
            <div className="relative w-full rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:p-8">
              <PreviewSurvey questions={questions} brandColor="#00C4B8" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last w-full rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:py-8 md:order-first">
              <div className="mx-auto md:w-3/4">
                <AddEventDummy />
              </div>
            </div>
            <div className="pb-8 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 4</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Set segment and trigger
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Create a custom segment for each survey. Use attributes and past events to only survey the
                people who have answers. Trigger your survey on any event in your application. Context
                matters.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 sm:pl-10 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 5</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
                Make better decisions
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Gather all insights you can - including partial submissions. Build conviction for the next
                product decision. Better data, better business.
              </p>
            </div>
            <div className="sm:scale-125 sm:p-8">
              <Image
                src={DashboardMockup}
                quality="100"
                alt="Data Pipelines"
                className="block rounded-lg dark:hidden"
              />
              <Image
                src={DashboardMockupDark}
                quality="100"
                alt="Data Pipelines"
                className="hidden dark:block"
              />
            </div>
          </div>
        </div>
      </div>

      <AddNoCodeEventModalDummy open={isAddEventModalOpen} setOpen={setAddEventModalOpen} />
    </>
  );
}
