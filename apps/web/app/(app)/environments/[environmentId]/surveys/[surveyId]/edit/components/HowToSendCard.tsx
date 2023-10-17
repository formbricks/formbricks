"use client";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TSurvey, TSurveyType } from "@formbricks/types/v1/surveys";
import { Badge } from "@formbricks/ui/Badge";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import {
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  LinkIcon,
} from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HowToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
  environment: TEnvironment;
}

export default function HowToSendCard({ localSurvey, setLocalSurvey, environment }: HowToSendCardProps) {
  const [open, setOpen] = useState(localSurvey.type === "web" ? false : true);
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  const setSurveyType = (type: TSurveyType) => {
    setLocalSurvey((prevSurvey) => ({
      ...prevSurvey,
      type,
      thankYouCard: {
        ...prevSurvey.thankYouCard,
        enabled: type === "link" ? true : prevSurvey.thankYouCard.enabled,
      },
    }));
  };

  const options = [
    {
      id: "web",
      name: "Web App",
      icon: ComputerDesktopIcon,
      description: "Embed a survey in your web app to collect responses.",
      comingSoon: false,
      alert: !widgetSetupCompleted,
    },
    {
      id: "link",
      name: "Link survey",
      icon: LinkIcon,
      description: "Share a link to a survey page.",
      comingSoon: false,
      alert: false,
    },
    {
      id: "mobile",
      name: "Mobile app",
      icon: DevicePhoneMobileIcon,
      description: "Survey users inside a mobile app (iOS & Android).",
      comingSoon: true,
      alert: false,
    },
    {
      id: "email",
      name: "Email",
      icon: EnvelopeIcon,
      description: "Send email surveys to your user base with your current email provider.",
      comingSoon: true,
      alert: false,
    },
  ];

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">How to ask</p>
            <p className="mt-1 text-sm text-slate-500">In-app survey, link survey or email survey.</p>
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
            className="flex flex-col space-y-3">
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
                        <Badge text="coming soon" size="normal" type="success" className="ml-2" />
                      )}
                    </div>
                    <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                    {option.alert && (
                      <div className="mt-2 flex items-center space-x-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
                        <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                        <div className=" text-amber-800">
                          <p className="text-xs font-semibold">
                            Your app is not yet connected to Formbricks.
                          </p>
                          <p className="text-xs font-normal">
                            Follow the{" "}
                            <Link
                              href={`/environments/${environment.id}/settings/setup`}
                              className="underline hover:text-amber-900"
                              target="_blank">
                              set up guide
                            </Link>{" "}
                            to connect Formbricks and launch surveys in your app.
                          </p>
                        </div>
                      </div>
                    )}
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
