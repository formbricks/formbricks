"use client";

import ProlificLogo from "@/images/prolific-logo.webp";
import ProlificUI from "@/images/prolific-screenshot.webp";
import { ArrowLeftIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@formbricks/ui/Button";

interface PanelInfoViewProps {
  handleInitialPageButton: () => void;
}

export const PanelInfoView = ({ handleInitialPageButton }: PanelInfoViewProps) => {
  return (
    <div className="h-full overflow-hidden text-slate-900">
      <div className="border-b border-slate-200 py-2">
        <Button
          variant="minimal"
          className="focus:ring-0"
          onClick={handleInitialPageButton}
          StartIcon={ArrowLeftIcon}>
          Back
        </Button>
      </div>
      <div className="grid h-full grid-cols-2">
        <div className="flex flex-col gap-y-6 border-r border-slate-200 p-8">
          <Image src={ProlificUI} alt="Prolific panel selection UI" className="rounded-lg shadow-lg" />
          <div>
            <p className="text-md font-semibold">What is a panel?</p>
            <p className="text-slate-600">
              A panel is a group of participants selected based on characteristics such as age, profession,
              gender, etc.
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">When do I need it?</p>
            <p className="text-slate-600">
              If you don’t have access to enough people who match your target audience, it makes sense to pay
              for access to a panel.
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">What is Prolific?</p>
            <p className="text-slate-600">
              We’re partnering with Prolific to offer you access to a pool of 200.000 participant to do
              research with.
            </p>
          </div>
        </div>
        <div className="relative flex flex-col gap-y-6 bg-slate-50 p-8">
          <Image
            src={ProlificLogo}
            alt="Prolific panel selection UI"
            className="absolute right-8 top-8 w-32"
          />
          <div>
            <h3 className="text-xl font-semibold">How to create a panel</h3>
          </div>
          <div>
            <p className="text-md font-semibold">Step 1: Create an account with Prolific</p>
            <p className="text-slate-600">
              We partner with Prolific to give you access to a pool of over 200.000 vetted participants.
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">Step 2: Create a study</p>
            <p className="text-slate-600">
              At Prolific, you create a new study where you can pick your preferred audience based on hundreds
              of characteristics.
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">Step 3: Connect your survey</p>
            <p className="text-slate-600">
              Set up hidden fields in your Formbricks survey to track which participant provided which answer.
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">Step 4: Launch your study</p>
            <p className="text-slate-600">
              Once everything is setup, you can launch your study. Within a few hours you’ll receive the first
              responses.
            </p>
          </div>
          <Button
            className="justify-center"
            href="https://formbricks.com/docs/link-surveys/market-research-panel"
            target="_blank">
            Get started
          </Button>
        </div>
      </div>
    </div>
  );
};
