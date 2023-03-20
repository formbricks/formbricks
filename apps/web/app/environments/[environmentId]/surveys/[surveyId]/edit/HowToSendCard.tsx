"use client";

import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
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
  {
    id: "link",
    name: "Standalone Survey (Link)",
    icon: LinkIcon,
    description: "Create personalized survey links to share around.",
    comingSoon: true,
  },
];

interface AddQuestionButtonProps {}

export default function HowToSendCard({}: AddQuestionButtonProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2 rounded-lg border border-gray-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full">
        <div className="inline-flex p-4">
          <CheckCircleIcon className="-ml-0.5 mr-1 h-5 w-5 text-teal-400" />
          <div>
            <p className="text-sm font-semibold">How to send</p>
            <p className="mt-1 truncate text-sm text-gray-500">Choose how you want to reach your audience</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup defaultValue="web" className="flex flex-col space-y-3">
            {options.map((option) => (
              <Label
                htmlFor={option.id}
                className="flex w-full items-center rounded-lg border border-slate-300 p-4 shadow">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="mx-5"
                  disabled={option.comingSoon}
                />
                <div className="inline-flex items-center">
                  <option.icon className="mr-4 h-8 w-8 text-slate-500" />
                  <div>
                    <div className="inline-flex items-center">
                      <p className="font-semibold text-slate-800">{option.name}</p>
                      {option.comingSoon && (
                        <span className="ml-2 inline-flex items-center rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                          coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-light text-slate-600">{option.description}</p>
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
