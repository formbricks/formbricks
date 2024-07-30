"use client";

import { EditorCardMenu } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/EditorCardMenu";
import { formatTextWithSlashes } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { GripIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { OptionsSwitch } from "@formbricks/ui/OptionsSwitch";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";
import { TooltipRenderer } from "@formbricks/ui/Tooltip";

interface EditEndingCardProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: string | null;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
  plan: TOrganizationBillingPlan;
  addEndingCard: (index: number) => void;
  isFormbricksCloud: boolean;
}

const endingCardTypes = [
  { value: "endScreen", label: "End Screen" },
  { value: "redirectToUrl", label: "Redirect to Url" },
];

export const EditEndingCard = ({
  localSurvey,
  endingCardIndex,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  plan,
  addEndingCard,
  isFormbricksCloud,
}: EditEndingCardProps) => {
  const endingCard = localSurvey.endings[endingCardIndex];
  const isRedirectToUrlDisabled = isFormbricksCloud
    ? plan === "free" && endingCard.type !== "redirectToUrl"
    : false;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: endingCard.id,
  });
  let open = activeQuestionId === endingCard.id;
  const [showEndingCardCTA, setshowEndingCardCTA] = useState<boolean>(
    endingCard.type === "endScreen" &&
      (!!getLocalizedValue(endingCard.buttonLabel, selectedLanguageCode) || !!endingCard.buttonLink)
  );
  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId(endingCard.id);
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data) => {
    const updatedEndings = localSurvey.endings.map((ending, idx) =>
      idx === endingCardIndex ? { ...ending, ...data } : ending
    );

    const updatedSurvey = {
      ...localSurvey,
      endings: updatedEndings,
    };

    setLocalSurvey(updatedSurvey);
  };

  const deleteEndingCard = () => {
    const updatedEndings = localSurvey.endings.filter((_, index) => {
      return index !== endingCardIndex;
    });
    setLocalSurvey({ ...localSurvey, endings: updatedEndings });
  };

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  const duplicateEndingCard = () => {
    const updatedSurvey = structuredClone(localSurvey);
    const endingToDuplicate = updatedSurvey.endings[endingCardIndex];

    // Create a new ending card by cloning the one to be duplicated and giving it a new ID
    const duplicatedEndingCard = {
      ...endingToDuplicate,
      id: createId(),
    };

    // Insert the duplicated ending card immediately after the original
    updatedSurvey.endings.splice(endingCardIndex + 1, 0, duplicatedEndingCard);

    setLocalSurvey(updatedSurvey);
  };

  const moveEndingCard = (endingCardIndex: number, up: boolean) => {
    const newEndings = Array.from(localSurvey.endings);
    const [reorderedEndings] = newEndings.splice(endingCardIndex, 1);
    const destinationIndex = up ? endingCardIndex - 1 : endingCardIndex + 1;
    newEndings.splice(destinationIndex, 0, reorderedEndings);
    const updatedSurvey = { ...localSurvey, endings: newEndings };
    setLocalSurvey(updatedSurvey);
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
        "group z-20 flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}
      ref={setNodeRef}
      style={style}
      id={endingCard.id}>
      <div
        {...listeners}
        {...attributes}
        className={cn(
          open ? "bg-slate-50" : "",
          "flex w-10 flex-col items-center justify-between rounded-l-lg border-b border-l border-t py-2 group-aria-expanded:rounded-bl-none",
          isInvalid ? "bg-red-400" : "bg-white group-hover:bg-slate-50"
        )}>
        <p>↪️</p>
        <button className="opacity-0 transition-all duration-300 hover:cursor-move group-hover:opacity-100">
          <GripIcon className="h-4 w-4" />
        </button>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-5 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">
                  {endingCard.type === "endScreen" &&
                    (endingCard.headline &&
                    recallToHeadline(
                      endingCard.headline,
                      localSurvey,
                      true,
                      selectedLanguageCode,
                      attributeClasses
                    )[selectedLanguageCode]
                      ? formatTextWithSlashes(
                          recallToHeadline(
                            endingCard.headline,
                            localSurvey,
                            true,
                            selectedLanguageCode,
                            attributeClasses
                          )[selectedLanguageCode]
                        )
                      : "Ending Card")}
                  {(endingCard.type === "redirectToUrl" && endingCard.label) ?? "Ending Card"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <EditorCardMenu
                survey={localSurvey}
                cardIdx={endingCardIndex}
                lastCard={endingCardIndex === localSurvey.endings.length - 1}
                duplicateCard={duplicateEndingCard}
                deleteCard={deleteEndingCard}
                moveCard={moveEndingCard}
                card={endingCard}
                updateCard={() => {}}
                addCard={addEndingCard}
                cardType="ending"
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="mt-3 px-4 pb-6">
          <TooltipRenderer
            shouldRender={endingCard.type === "endScreen" && isRedirectToUrlDisabled}
            tooltipContent={"Redirect To Url is not available on free plan"}
            triggerClass="w-full">
            <OptionsSwitch
              options={endingCardTypes}
              currentOption={endingCard.type}
              handleOptionChange={() => {
                if (endingCard.type === "endScreen") {
                  updateSurvey({ type: "redirectToUrl" });
                } else {
                  updateSurvey({ type: "endScreen" });
                }
              }}
              disabled={isRedirectToUrlDisabled}
            />
          </TooltipRenderer>
          {endingCard.type === "endScreen" && (
            <form>
              <QuestionFormInput
                id="headline"
                label="Note*"
                value={endingCard.headline}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
                isInvalid={isInvalid}
                updateSurvey={updateSurvey}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />

              <QuestionFormInput
                id="subheader"
                value={endingCard.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
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
                    checked={showEndingCardCTA}
                    onCheckedChange={() => {
                      if (showEndingCardCTA) {
                        updateSurvey({ buttonLabel: undefined, buttonLink: undefined });
                      } else {
                        updateSurvey({
                          buttonLabel: { default: "Create your own Survey" },
                          buttonLink: "https://formbricks.com/signup",
                        });
                      }
                      setshowEndingCardCTA(!showEndingCardCTA);
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
                {showEndingCardCTA && (
                  <div className="border-1 mt-4 space-y-4 rounded-md border bg-slate-100 p-4 pt-2">
                    <div className="space-y-2">
                      <QuestionFormInput
                        id="buttonLabel"
                        label="Button Label"
                        placeholder="Create your own Survey"
                        className="bg-white"
                        value={endingCard.buttonLabel}
                        localSurvey={localSurvey}
                        questionIdx={localSurvey.questions.length + endingCardIndex}
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
                        value={endingCard.buttonLink}
                        onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
          {endingCard.type === "redirectToUrl" && (
            <form className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  id="redirectUrl"
                  name="redirectUrl"
                  className="bg-white"
                  placeholder="https://formbricks.com/signup"
                  value={endingCard.url}
                  onChange={(e) => updateSurvey({ url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  id="redirectUrlLabel"
                  name="redirectUrlLabel"
                  className="bg-white"
                  placeholder="Formbricks App"
                  value={endingCard.label}
                  onChange={(e) => updateSurvey({ label: e.target.value })}
                />
              </div>
            </form>
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
