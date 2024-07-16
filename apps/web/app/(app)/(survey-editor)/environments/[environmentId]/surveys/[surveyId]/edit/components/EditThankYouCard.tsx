"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";

interface EditThankYouCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: string | null;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
}

export const EditThankYouCard = ({
  localSurvey,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: EditThankYouCardProps) => {
  // const [open, setOpen] = useState(false);
  let open = activeQuestionId == "end";
  const [showThankYouCardCTA, setshowThankYouCardCTA] = useState<boolean>(
    getLocalizedValue(localSurvey.thankYouCard.buttonLabel, "default") || localSurvey.thankYouCard.buttonLink
      ? true
      : false
  );
  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId("end");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    const updatedSurvey = {
      ...localSurvey,
      thankYouCard: {
        ...localSurvey.thankYouCard,
        ...data,
      },
    };
    setLocalSurvey(updatedSurvey);
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
        "group z-20 flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-50" : "",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none",
          isInvalid ? "bg-red-400" : "bg-white group-hover:bg-slate-50"
        )}>
        <p>🙏</p>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Thank You Card</p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {localSurvey?.thankYouCard?.enabled ? "Shown" : "Hidden"}
                  </p>
                )}
              </div>
            </div>

            {localSurvey.type !== "link" && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="thank-you-toggle">Show</Label>

                <Switch
                  id="thank-you-toggle"
                  checked={localSurvey?.thankYouCard?.enabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSurvey({ enabled: !localSurvey.thankYouCard?.enabled });
                  }}
                />
              </div>
            )}
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <form>
            <QuestionFormInput
              id="headline"
              label="Note*"
              value={localSurvey?.thankYouCard?.headline}
              localSurvey={localSurvey}
              questionIdx={localSurvey.questions.length}
              isInvalid={isInvalid}
              updateSurvey={updateSurvey}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              attributeClasses={attributeClasses}
            />

            <QuestionFormInput
              id="subheader"
              value={localSurvey.thankYouCard.subheader}
              label={"Description"}
              localSurvey={localSurvey}
              questionIdx={localSurvey.questions.length}
              isInvalid={isInvalid}
              updateSurvey={updateSurvey}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              attributeClasses={attributeClasses}
            />
            <div className="mt-4">
              <div className="flex items-center space-x-1">
                <Switch
                  id="showButton"
                  checked={showThankYouCardCTA}
                  onCheckedChange={() => {
                    if (showThankYouCardCTA) {
                      updateSurvey({ buttonLabel: undefined, buttonLink: undefined });
                    } else {
                      updateSurvey({
                        buttonLabel: { default: "Create your own Survey" },
                        buttonLink: "https://formbricks.com/signup",
                      });
                    }
                    setshowThankYouCardCTA(!showThankYouCardCTA);
                  }}
                />
                <Label htmlFor="showButton" className="cursor-pointer">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Show Button</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Send your respondents to a page of your choice.
                    </p>
                  </div>
                </Label>
              </div>
              {showThankYouCardCTA && (
                <div className="border-1 mt-4 space-y-4 rounded-md border bg-slate-100 p-4 pt-2">
                  <div className="space-y-2">
                    <QuestionFormInput
                      id="buttonLabel"
                      label="Button Label"
                      placeholder="Create your own Survey"
                      className="bg-white"
                      value={localSurvey.thankYouCard.buttonLabel}
                      localSurvey={localSurvey}
                      questionIdx={localSurvey.questions.length}
                      isInvalid={isInvalid}
                      updateSurvey={updateSurvey}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      attributeClasses={attributeClasses}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Button Link</Label>
                    <Input
                      id="buttonLink"
                      name="buttonLink"
                      className="bg-white"
                      placeholder="https://formbricks.com/signup"
                      value={localSurvey.thankYouCard.buttonLink}
                      onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
