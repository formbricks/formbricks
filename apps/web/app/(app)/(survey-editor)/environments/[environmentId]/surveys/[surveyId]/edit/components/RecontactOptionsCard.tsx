"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";

interface DisplayOption {
  id: "displayOnce" | "displayMultiple" | "respondMultiple" | "displaySome";
  name: string;
  description: string;
}

const displayOptions: DisplayOption[] = [
  {
    id: "displayOnce",
    name: "Show only once",
    description: "The survey will be shown once, even if person doesn't respond.",
  },
  {
    id: "displaySome",
    name: "Show multiple times",
    description: "The survey will be shown multiple times until they respond",
  },
  {
    id: "displayMultiple",
    name: "Until they submit a response",
    description: "If you really want that answer, ask until you get it.",
  },
  {
    id: "respondMultiple",
    name: "Keep showing while conditions match",
    description: "Even after they submitted a response (e.g. Feedback Box)",
  },
];

interface RecontactOptionsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environmentId: string;
}

export const RecontactOptionsCard = ({
  localSurvey,
  setLocalSurvey,
  environmentId,
}: RecontactOptionsCardProps) => {
  const [open, setOpen] = useState(false);
  const ignoreWaiting = localSurvey.recontactDays !== null;
  const [inputDays, setInputDays] = useState(
    localSurvey.recontactDays !== null ? localSurvey.recontactDays : 1
  );
  const [displayLimit, setDisplayLimit] = useState(localSurvey.displayLimit ?? 1);

  const handleCheckMark = () => {
    if (ignoreWaiting) {
      const updatedSurvey = { ...localSurvey, recontactDays: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, recontactDays: 0 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleRecontactDaysChange = (event) => {
    const value = Number(event.target.value);
    setInputDays(value);

    const updatedSurvey = { ...localSurvey, recontactDays: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleRecontactSessionDaysChange = (event) => {
    const value = Number(event.target.value);
    setDisplayLimit(value);

    const updatedSurvey = { ...localSurvey, displayLimit: value } satisfies TSurvey;
    setLocalSurvey(updatedSurvey);
  };

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (localSurvey.type !== "link") {
          setOpen(openState);
        }
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50"
        id="recontactOptionsCardTrigger">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Recontact Options</p>
            <p className="mt-1 text-sm text-slate-500">Decide how often people can answer this survey.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="pb-3">
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup
            value={localSurvey.displayOption}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              if (v === "displayOnce" || v === "displayMultiple" || v === "respondMultiple") {
                const updatedSurvey: TSurvey = { ...localSurvey, displayOption: v };
                setLocalSurvey(updatedSurvey);
              } else if (v === "displaySome") {
                const updatedSurvey: TSurvey = {
                  ...localSurvey,
                  displayOption: v,
                  displayLimit,
                };
                setLocalSurvey(updatedSurvey);
              }
            }}>
            {displayOptions.map((option) => (
              <>
                <Label
                  key={option.name}
                  htmlFor={option.name}
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <RadioGroupItem
                    value={option.id}
                    id={option.name}
                    className="aria-checked:border-brand-dark mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div>
                    <p className="font-semibold text-slate-700">{option.name}</p>

                    <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                  </div>
                </Label>
                {option.id === "displaySome" && localSurvey.displayOption === "displaySome" && (
                  <label htmlFor="displayLimit" className="cursor-pointer p-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Show survey maximum of
                      <Input
                        type="number"
                        min="1"
                        id="displayLimit"
                        value={displayLimit.toString()}
                        onChange={(e) => handleRecontactSessionDaysChange(e)}
                        className="mx-2 inline w-16 bg-white text-center text-sm"
                      />
                      times.
                    </p>
                  </label>
                )}
              </>
            ))}
          </RadioGroup>
        </div>

        <AdvancedOptionToggle
          htmlId="recontactDays"
          isChecked={ignoreWaiting}
          onToggle={handleCheckMark}
          title="Ignore waiting time between surveys"
          childBorder={false}
          description={
            <>
              This setting overwrites your{" "}
              <Link
                className="decoration-brand-dark underline"
                href={`/environments/${environmentId}/product/general`}
                target="_blank">
                waiting period
              </Link>
              . Use with caution.
            </>
          }>
          {localSurvey.recontactDays !== null && (
            <RadioGroup
              value={localSurvey.recontactDays.toString()}
              className="flex w-full flex-col space-y-3 bg-white"
              onValueChange={(v) => {
                const updatedSurvey = { ...localSurvey, recontactDays: v === "null" ? null : Number(v) };
                setLocalSurvey(updatedSurvey);
              }}>
              <Label
                htmlFor="ignore"
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value="0"
                  id="ignore"
                  className="aria-checked:border-brand-dark mx-4 text-sm disabled:border-slate-400 aria-checked:border-2"
                />
                <div>
                  <p className="font-semibold text-slate-700">Always show survey</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">
                    When conditions match, waiting time will be ignored and survey shown.
                  </p>
                </div>
              </Label>

              <label
                htmlFor="newDays"
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={inputDays === 0 ? "1" : inputDays.toString()} //Fixes that both radio buttons are checked when inputDays is 0
                  id="newDays"
                  className="aria-checked:border-brand-dark mx-4 disabled:border-slate-400 aria-checked:border-2"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Wait
                    <Input
                      type="number"
                      min="1"
                      id="inputDays"
                      value={inputDays === 0 ? 1 : inputDays}
                      onChange={handleRecontactDaysChange}
                      className="ml-2 mr-2 inline w-16 bg-white text-center text-sm"
                    />
                    days before showing this survey again.
                  </p>

                  <p className="mt-2 text-xs font-normal text-slate-600">
                    Overwrites waiting period between surveys to {inputDays === 0 ? 1 : inputDays} day(s).
                  </p>
                </div>
              </label>
            </RadioGroup>
          )}
        </AdvancedOptionToggle>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
