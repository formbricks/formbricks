"use client";

import type { Survey } from "@formbricks/types/surveys";
import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui/Badge";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import {
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  LinkIcon,
} from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

const options = [
  {
    id: "web",
    name: "Web app",
    icon: ComputerDesktopIcon,
    description: "Send the survey to your audience through your web app.",
    comingSoon: false,
  },
  {
    id: "link",
    name: "Link survey",
    icon: LinkIcon,
    description: "Creates a standalone survey to share via link.",
    comingSoon: false,
  },
  {
    id: "mobile",
    name: "Mobile app",
    icon: DevicePhoneMobileIcon,
    description: "Survey users inside a mobile app (iOS & Android).",
    comingSoon: true,
  },
  {
    id: "email",
    name: "Email",
    icon: EnvelopeIcon,
    description: "Send email surveys to your user base with your current email provider.",
    comingSoon: true,
  },
];

interface HowToSendCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function HowToSendCard({ localSurvey, setLocalSurvey }: HowToSendCardProps) {
  const [open, setOpen] = useState(false);

  const setSurveyType = (type: string) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.type = type;
    if (type === "link") {
      updatedSurvey.thankYouCard.enabled = true;
    }
    setLocalSurvey(updatedSurvey);
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">How to ask</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              In-app survey, link survey or email survey.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup
            defaultValue="web"
            value={localSurvey.type}
            onValueChange={setSurveyType}
            className="flex flex-col space-y-3"
            disabled={localSurvey.status !== "draft"}>
            {options.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(
                  "flex w-full  items-center rounded-lg border bg-slate-50 p-4",
                  option.comingSoon
                    ? "border-slate-200 bg-slate-50/50"
                    : option.id === localSurvey.type
                    ? "border-brand-dark cursor-pointer bg-slate-50"
                    : "cursor-pointer bg-slate-50"
                )}>
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                  disabled={option.comingSoon}
                />
                <div className=" inline-flex items-center">
                  <option.icon className="mr-4 h-8 w-8 text-slate-500" />
                  <div>
                    <div className="inline-flex items-center">
                      <p
                        className={cn(
                          "font-semibold",
                          option.comingSoon ? "text-slate-500" : "text-slate-800"
                        )}>
                        {option.name}
                      </p>
                      {option.comingSoon && (
                        <Badge text="coming soon" size="normal" type="warning" className="ml-2" />
                      )}
                    </div>
                    <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
