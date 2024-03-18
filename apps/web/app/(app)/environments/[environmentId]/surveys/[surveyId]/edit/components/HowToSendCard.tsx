"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { AlertCircleIcon, CheckIcon, LinkIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveyType } from "@formbricks/types/surveys";
import { Badge } from "@formbricks/ui/Badge";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";

interface HowToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
  environment: TEnvironment;
}

export default function HowToSendCard({ localSurvey, setLocalSurvey, environment }: HowToSendCardProps) {
  const [open, setOpen] = useState(false);
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
      name: "In-App Survey",
      icon: MonitorIcon,
      description: "Embed a survey in your web app to collect responses.",
      comingSoon: false,
      alert: !widgetSetupCompleted,
    },
    {
      id: "link",
      name: "Link survey",
      icon: LinkIcon,
      description: "Share a link to a survey page or embed it in a web page or email.",
      comingSoon: false,
      alert: false,
    },
    {
      id: "mobile",
      name: "Mobile App Survey",
      icon: SmartphoneIcon,
      description: "Survey users inside a mobile app (iOS & Android).",
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
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer"
        id="howToSendCardTrigger">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border bg-green-400 p-1.5 text-white"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Survey Type</p>
            <p className="mt-1 text-sm text-slate-500">Choose between in-app or link survey.</p>
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
                )}
                id={`howToSendCardOption-${option.id}`}>
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
                        <AlertCircleIcon className="h-5 w-5 text-amber-500" />
                        <div className=" text-amber-800">
                          <p className="text-xs font-semibold">
                            Your app is not yet connected to Formbricks.
                          </p>
                          <p className="text-xs font-normal">
                            <Link
                              href={`/environments/${environment.id}/settings/setup`}
                              className="underline hover:text-amber-900"
                              target="_blank">
                              Connect Formbricks
                            </Link>{" "}
                            and launch surveys in your app or website.
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
