"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";

interface DisplayOption {
  id: "displayOnce" | "displayMultiple" | "respondMultiple" | "displaySome";
  name: string;
  description: string;
}

interface WaitingTimeOption {
  id: "respect" | "ignore" | "overwrite";
  value: number | null;
  name: string;
  description: string;
}

interface RecontactOptionsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
}

export const RecontactOptionsCard = ({ localSurvey, setLocalSurvey }: RecontactOptionsCardProps) => {
  const { t } = useTranslation();

  const waitingTimeOptions: WaitingTimeOption[] = useMemo(
    () => [
      {
        id: "respect",
        value: null,
        name: t("environments.surveys.edit.respect_global_waiting_time"),
        description: t("environments.surveys.edit.respect_global_waiting_time_description"),
      },
      {
        id: "ignore",
        value: 0,
        name: t("environments.surveys.edit.ignore_global_waiting_time"),
        description: t("environments.surveys.edit.ignore_global_waiting_time_description"),
      },
      {
        id: "overwrite",
        value: 1,
        name: t("environments.surveys.edit.overwrite_global_waiting_time"),
        description: t("environments.surveys.edit.overwrite_global_waiting_time_description"),
      },
    ],
    [t]
  );

  const displayOptions: DisplayOption[] = useMemo(
    () => [
      {
        id: "displayOnce",
        name: t("environments.surveys.edit.show_only_once"),
        description: t(
          "environments.surveys.edit.the_survey_will_be_shown_once_even_if_person_doesnt_respond"
        ),
      },
      {
        id: "displaySome",
        name: t("environments.surveys.edit.show_multiple_times"),
        description: t(
          "environments.surveys.edit.the_survey_will_be_shown_multiple_times_until_they_respond"
        ),
      },
      {
        id: "displayMultiple",
        name: t("environments.surveys.edit.until_they_submit_a_response"),
        description: t("environments.surveys.edit.if_you_really_want_that_answer_ask_until_you_get_it"),
      },
      {
        id: "respondMultiple",
        name: t("environments.surveys.edit.keep_showing_while_conditions_match"),
        description: t("environments.surveys.edit.even_after_they_submitted_a_response_e_g_feedback_box"),
      },
    ],
    [t]
  );

  const [open, setOpen] = useState(false);
  const [inputDays, setInputDays] = useState(
    localSurvey.recontactDays !== null && localSurvey.recontactDays > 0 ? localSurvey.recontactDays : 1
  );
  const [displayLimit, setDisplayLimit] = useState(localSurvey.displayLimit ?? 1);

  // Determine current waiting time option
  const getWaitingTimeOption = (): "respect" | "ignore" | "overwrite" => {
    if (localSurvey.recontactDays === null) return "respect";
    if (localSurvey.recontactDays === 0) return "ignore";
    return "overwrite";
  };

  // Auto animate
  const [parent] = useAutoAnimate();

  const handleWaitingTimeChange = (optionId: string) => {
    const option = waitingTimeOptions.find((opt) => opt.id === optionId);
    if (option) {
      let newRecontactDays = option.value;
      if (optionId === "overwrite") {
        newRecontactDays = inputDays;
      }
      const updatedSurvey = { ...localSurvey, recontactDays: newRecontactDays };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleOverwriteDaysChange = (event) => {
    let value = Number(event.target.value);
    if (Number.isNaN(value) || value < 1) {
      value = 1;
    } else if (value > 365) {
      value = 365;
    }
    setInputDays(value);

    const updatedSurvey = { ...localSurvey, recontactDays: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleDisplayLimitChange = (event) => {
    let value = Number(event.target.value);
    if (Number.isNaN(value) || value < 1) {
      value = 1;
    }
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
            <p className="font-semibold text-slate-800">
              {t("environments.surveys.edit.visibility_and_recontact")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.visibility_and_recontact_description")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className={`flex flex-col ${open && "pb-3"}`} ref={parent}>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          {/* Waiting Time Section */}
          <div className="mb-4 space-y-1 px-1">
            <h3 className="font-semibold text-slate-800">
              {t("environments.surveys.edit.waiting_time_across_surveys")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("environments.surveys.edit.waiting_time_across_surveys_description")}
            </p>
          </div>

          <RadioGroup
            value={getWaitingTimeOption()}
            className="flex flex-col space-y-3"
            onValueChange={handleWaitingTimeChange}>
            {waitingTimeOptions.map((option) => (
              <div key={option.id}>
                <Label
                  htmlFor={`waiting-time-${option.id}`}
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4"
                  data-testid={`waiting-time-option-${option.id}`}>
                  <RadioGroupItem
                    value={option.id}
                    id={`waiting-time-${option.id}`}
                    className="aria-checked:border-brand-dark mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div>
                    <p className="font-semibold text-slate-700">{option.name}</p>
                    <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                  </div>
                </Label>
                {option.id === "overwrite" && getWaitingTimeOption() === "overwrite" && (
                  <div className="border-t-none -mt-1.5 w-full rounded-b-lg border bg-slate-50 p-4">
                    <label htmlFor="overwriteDays">
                      <p className="text-sm text-slate-700">
                        {t("environments.surveys.edit.wait")}
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          id="overwriteDays"
                          value={inputDays}
                          onChange={handleOverwriteDaysChange}
                          className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
                        />
                        {t("environments.surveys.edit.days_before_showing_this_survey_again")}
                      </p>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </RadioGroup>
        </div>

        <hr className="my-3 text-slate-600" />

        <div className="p-3">
          {/* Recontact Options Section */}
          <div className="mb-4 space-y-1 px-1">
            <h3 className="font-semibold text-slate-800">
              {t("environments.surveys.edit.recontact_options_section")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("environments.surveys.edit.recontact_options_section_description")}
            </p>
          </div>

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
              <div key={option.id}>
                <Label
                  key={option.name}
                  htmlFor={`recontact-option-${option.id}`}
                  className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4"
                  data-testid={`recontact-option-${option.id}`}>
                  <RadioGroupItem
                    value={option.id}
                    id={`recontact-option-${option.id}`}
                    className="aria-checked:border-brand-dark mx-5 disabled:border-slate-400 aria-checked:border-2"
                  />
                  <div>
                    <p className="font-semibold text-slate-700">{option.name}</p>

                    <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                  </div>
                </Label>
                {option.id === "displaySome" && localSurvey.displayOption === "displaySome" && (
                  <div className="border-t-none -mt-1.5 w-full rounded-b-lg border bg-slate-50 p-4">
                    <label htmlFor="displayLimit">
                      <p className="text-sm text-slate-700">
                        {t("environments.surveys.edit.show_survey_maximum_of")}
                        <Input
                          type="number"
                          min="1"
                          id="displayLimit"
                          value={displayLimit.toString()}
                          onChange={(e) => handleDisplayLimitChange(e)}
                          className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
                        />
                        {t("environments.surveys.edit.times")}.
                      </p>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
