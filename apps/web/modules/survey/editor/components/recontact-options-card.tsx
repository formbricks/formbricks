"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface DisplayOption {
  id: "displayOnce" | "displayMultiple" | "respondMultiple" | "displaySome";
  name: string;
  description: string;
}

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
  const { t } = useTranslate();

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
  const ignoreWaiting = localSurvey.recontactDays !== null;
  const [inputDays, setInputDays] = useState(
    localSurvey.recontactDays !== null ? localSurvey.recontactDays : 1
  );
  const [displayLimit, setDisplayLimit] = useState(localSurvey.displayLimit ?? 1);

  // Auto animate
  const [parent] = useAutoAnimate();

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
          <div className="flex items-center pr-5 pl-2">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("environments.surveys.edit.recontact_options")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.decide_how_often_people_can_answer_this_survey")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className={`flex flex-col ${open && "pb-3"}`} ref={parent}>
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
              <div key={option.id}>
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
                    <p className="font-semibold text-slate-700">{t(option.name)}</p>

                    <p className="mt-2 text-xs font-normal text-slate-600">{t(option.description)}</p>
                  </div>
                </Label>
                {option.id === "displaySome" && localSurvey.displayOption === "displaySome" && (
                  <label htmlFor="displayLimit" className="cursor-pointer p-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {t("environments.surveys.edit.show_survey_maximum_of")}
                      <Input
                        type="number"
                        min="1"
                        id="displayLimit"
                        value={displayLimit.toString()}
                        onChange={(e) => handleRecontactSessionDaysChange(e)}
                        className="mx-2 inline w-16 bg-white text-center text-sm"
                      />
                      {t("environments.surveys.edit.times")}.
                    </p>
                  </label>
                )}
              </div>
            ))}
          </RadioGroup>
        </div>

        <AdvancedOptionToggle
          htmlId="recontactDays"
          isChecked={ignoreWaiting}
          onToggle={handleCheckMark}
          title={t("environments.surveys.edit.ignore_waiting_time_between_surveys")}
          childBorder={false}
          description={
            <>
              {t("environments.surveys.edit.this_setting_overwrites_your")}{" "}
              <Link
                className="decoration-brand-dark underline"
                href={`/environments/${environmentId}/project/general`}
                target="_blank">
                {t("environments.surveys.edit.waiting_period")}
              </Link>
              . {t("environments.surveys.edit.use_with_caution")}
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
                  <p className="font-semibold text-slate-700">
                    {t("environments.surveys.edit.always_show_survey")}
                  </p>

                  <p className="mt-2 text-xs font-normal text-slate-600">
                    {t(
                      "environments.surveys.edit.when_conditions_match_waiting_time_will_be_ignored_and_survey_shown"
                    )}
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
                    {t("environments.surveys.edit.wait")}
                    <Input
                      type="number"
                      min="1"
                      id="inputDays"
                      value={inputDays === 0 ? 1 : inputDays}
                      onChange={handleRecontactDaysChange}
                      className="mr-2 ml-2 inline w-16 bg-white text-center text-sm"
                    />
                    {t("environments.surveys.edit.days_before_showing_this_survey_again")}.
                  </p>

                  <p className="mt-2 text-xs font-normal text-slate-600">
                    {t("environments.surveys.edit.overwrites_waiting_period_between_surveys_to_x_days", {
                      days: inputDays === 0 ? 1 : inputDays,
                    })}
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
