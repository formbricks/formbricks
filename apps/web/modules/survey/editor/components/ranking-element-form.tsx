"use client";

import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyRankingElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { ElementOptionChoice } from "@/modules/survey/editor/components/element-option-choice";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";

interface RankingElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyRankingElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyRankingElement>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const RankingElementForm = ({
  element,
  elementIdx,
  updateElement,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: RankingElementFormProps): JSX.Element => {
  const { t } = useTranslation();
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isInvalidValue, setIsInvalidValue] = useState<string | null>(null);

  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const surveyLanguages = localSurvey.languages ?? [];

  const updateChoice = (choiceIdx: number, updatedAttributes: { label: TI18nString }) => {
    if (element.choices) {
      const newChoices = element.choices.map((choice, idx) => {
        if (idx !== choiceIdx) return choice;
        return { ...choice, ...updatedAttributes };
      });

      updateElement(elementIdx, { choices: newChoices });
    }
  };

  const addChoice = (choiceIdx: number) => {
    let newChoices = !element.choices ? [] : element.choices;

    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };

    updateElement(elementIdx, {
      choices: [...newChoices.slice(0, choiceIdx + 1), newChoice, ...newChoices.slice(choiceIdx + 1)],
    });
  };

  const addOption = () => {
    const choices = !element.choices ? [] : element.choices;

    if (choices.length >= 25) {
      return;
    }

    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };

    updateElement(elementIdx, { choices: [...choices, newChoice] });
  };

  const deleteChoice = (choiceIdx: number) => {
    const newChoices = element.choices.filter((_, idx) => idx !== choiceIdx);
    const choiceValue = element.choices[choiceIdx].label[selectedLanguageCode];

    if (isInvalidValue === choiceValue) {
      setIsInvalidValue(null);
    }

    updateElement(elementIdx, { choices: newChoices });
  };

  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: t("environments.surveys.edit.keep_current_order"),
      show: true,
    },
    all: {
      id: "all",
      label: t("environments.surveys.edit.randomize_all"),
      show: element.choices.length > 0,
    },
  };

  useEffect(() => {
    if (lastChoiceRef.current) {
      lastChoiceRef.current?.focus();
    }
  }, [element.choices?.length]);

  const [parent] = useAutoAnimate();

  return (
    <form>
      <ElementFormInput
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        elementIdx={elementIdx}
        isInvalid={isInvalid}
        updateElement={updateElement}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />

      <div ref={parent}>
        {element.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <ElementFormInput
                id="subheader"
                value={element.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={updateElement}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
                isExternalUrlsAllowed={isExternalUrlsAllowed}
              />
            </div>
          </div>
        )}
        {element.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateElement(elementIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">{t("environments.surveys.edit.options")}*</Label>
        <div className="mt-2" id="choices">
          <DndContext
            id="ranking-choices"
            onDragEnd={(event) => {
              const { active, over } = event;

              if (!active || !over) {
                return;
              }

              const activeIndex = element.choices.findIndex((choice) => choice.id === active.id);
              const overIndex = element.choices.findIndex((choice) => choice.id === over.id);

              const newChoices = [...element.choices];

              newChoices.splice(activeIndex, 1);
              newChoices.splice(overIndex, 0, element.choices[activeIndex]);

              updateElement(elementIdx, { choices: newChoices });
            }}>
            <SortableContext items={element.choices} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2" ref={parent}>
                {element.choices?.map((choice, choiceIdx) => (
                  <ElementOptionChoice
                    key={choice.id}
                    choice={choice}
                    choiceIdx={choiceIdx}
                    elementIdx={elementIdx}
                    updateChoice={updateChoice}
                    deleteChoice={deleteChoice}
                    addChoice={addChoice}
                    isInvalid={isInvalid}
                    localSurvey={localSurvey}
                    selectedLanguageCode={selectedLanguageCode}
                    setSelectedLanguageCode={setSelectedLanguageCode}
                    surveyLanguages={surveyLanguages}
                    element={element}
                    updateElement={updateElement}
                    surveyLanguageCodes={surveyLanguageCodes}
                    locale={locale}
                    isStorageConfigured={isStorageConfigured}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-2 flex flex-1 items-center justify-between gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              disabled={element.choices?.length >= 25}
              onClick={() => addOption()}>
              {t("environments.surveys.edit.add_option")}
              <PlusIcon />
            </Button>
            <ShuffleOptionSelect
              shuffleOptionsTypes={shuffleOptionsTypes}
              updateElement={updateElement}
              shuffleOption={element.shuffleOption}
              elementIdx={elementIdx}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
