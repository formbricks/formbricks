"use client";

import { AddEndingCardButton } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/AddEndingCardButton";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createId } from "@paralleldrive/cuid2";
import React, { SetStateAction, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MultiLanguageCard } from "@formbricks/ee/multi-language/components/multi-language-card";
import { addMultiLanguageLabels, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { getDefaultEndingCard } from "@formbricks/lib/templates";
import { checkForEmptyFallBackValue, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { findQuestionsWithCyclicLogic } from "@formbricks/types/surveys/validation";
import {
  isEndingCardValid,
  isWelcomeCardValid,
  validateQuestion,
  validateSurveyQuestionsInBatch,
} from "../lib/validation";
import { AddQuestionButton } from "./AddQuestionButton";
import { EditEndingCard } from "./EditEndingCard";
import { EditWelcomeCard } from "./EditWelcomeCard";
import { HiddenFieldsCard } from "./HiddenFieldsCard";
import { QuestionsDroppable } from "./QuestionsDroppable";

interface QuestionsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<SetStateAction<TSurvey>>;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  product: TProduct;
  invalidQuestions: string[] | null;
  setInvalidQuestions: React.Dispatch<SetStateAction<string[] | null>>;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  attributeClasses: TAttributeClass[];
  plan: TOrganizationBillingPlan;
}

export const QuestionsView = ({
  activeQuestionId,
  setActiveQuestionId,
  localSurvey,
  setLocalSurvey,
  product,
  invalidQuestions,
  setInvalidQuestions,
  setSelectedLanguageCode,
  selectedLanguageCode,
  isMultiLanguageAllowed,
  isFormbricksCloud,
  attributeClasses,
  plan,
}: QuestionsViewProps) => {
  const internalQuestionIdMap = useMemo(() => {
    return localSurvey.questions.reduce((acc, question) => {
      acc[question.id] = createId();
      return acc;
    }, {});
  }, [localSurvey.questions]);

  const surveyLanguages = localSurvey.languages;
  const [backButtonLabel, setbackButtonLabel] = useState(null);
  const handleQuestionLogicChange = (survey: TSurvey, compareId: string, updatedId: string): TSurvey => {
    survey.questions.forEach((question) => {
      if (question.headline[selectedLanguageCode].includes(`recall:${compareId}`)) {
        question.headline[selectedLanguageCode] = question.headline[selectedLanguageCode].replaceAll(
          `recall:${compareId}`,
          `recall:${updatedId}`
        );
      }
      if (!question.logic) return;
      question.logic.forEach((rule) => {
        if (rule.destination === compareId) {
          rule.destination = updatedId;
        }
      });
    });
    return survey;
  };

  useEffect(() => {
    if (!invalidQuestions) return;
    let updatedInvalidQuestions: string[] = invalidQuestions;

    // Check welcome card
    if (localSurvey.welcomeCard.enabled && !isWelcomeCardValid(localSurvey.welcomeCard, surveyLanguages)) {
      if (!updatedInvalidQuestions.includes("start")) {
        updatedInvalidQuestions.push("start");
      }
    } else {
      updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== "start");
    }

    // Check thank you card
    localSurvey.endings.forEach((ending) => {
      if (!isEndingCardValid(ending, surveyLanguages)) {
        if (!updatedInvalidQuestions.includes(ending.id)) {
          updatedInvalidQuestions.push(ending.id);
        }
      } else {
        updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== ending.id);
      }
    });

    if (JSON.stringify(updatedInvalidQuestions) !== JSON.stringify(invalidQuestions)) {
      setInvalidQuestions(updatedInvalidQuestions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey.languages, localSurvey.endings, localSurvey.welcomeCard]);

  // function to validate individual questions
  const validateSurveyQuestion = (question: TSurveyQuestion) => {
    // prevent this function to execute further if user hasnt still tried to save the survey
    if (invalidQuestions === null) {
      return;
    }

    const isFirstQuestion = question.id === localSurvey.questions[0].id;

    if (validateQuestion(question, surveyLanguages, isFirstQuestion)) {
      // If question is valid, we now check for cyclic logic
      const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(localSurvey.questions);

      if (questionsWithCyclicLogic.includes(question.id) && !invalidQuestions.includes(question.id)) {
        setInvalidQuestions([...invalidQuestions, question.id]);
        return;
      }

      setInvalidQuestions(invalidQuestions.filter((id) => id !== question.id));
      return;
    }

    setInvalidQuestions([...invalidQuestions, question.id]);
    return;
  };

  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    let updatedSurvey = { ...localSurvey };
    if ("id" in updatedAttributes) {
      // if the survey question whose id is to be changed is linked to logic of any other survey then changing it
      const initialQuestionId = updatedSurvey.questions[questionIdx].id;
      updatedSurvey = handleQuestionLogicChange(updatedSurvey, initialQuestionId, updatedAttributes.id);
      if (invalidQuestions?.includes(initialQuestionId)) {
        setInvalidQuestions(
          invalidQuestions.map((id) => (id === initialQuestionId ? updatedAttributes.id : id))
        );
      }

      // relink the question to internal Id
      internalQuestionIdMap[updatedAttributes.id] =
        internalQuestionIdMap[localSurvey.questions[questionIdx].id];
      delete internalQuestionIdMap[localSurvey.questions[questionIdx].id];
      setActiveQuestionId(updatedAttributes.id);
    }

    updatedSurvey.questions[questionIdx] = {
      ...updatedSurvey.questions[questionIdx],
      ...updatedAttributes,
    };

    if ("backButtonLabel" in updatedAttributes) {
      const backButtonLabel = updatedSurvey.questions[questionIdx].backButtonLabel;
      // If the value of backbuttonLabel is equal to {default:""}, then delete backButtonLabel key
      if (
        backButtonLabel &&
        Object.keys(backButtonLabel).length === 1 &&
        backButtonLabel["default"].trim() === ""
      ) {
        delete updatedSurvey.questions[questionIdx].backButtonLabel;
      } else {
        updatedSurvey.questions.forEach((question) => {
          question.backButtonLabel = updatedAttributes.backButtonLabel;
        });
        setbackButtonLabel(updatedAttributes.backButtonLabel);
      }
    }
    const attributesToCheck = ["buttonLabel", "upperLabel", "lowerLabel"];

    // If the value of buttonLabel, lowerLabel or upperLabel is equal to {default:""}, then delete buttonLabel key
    attributesToCheck.forEach((attribute) => {
      if (Object.keys(updatedAttributes).includes(attribute)) {
        const currentLabel = updatedSurvey.questions[questionIdx][attribute];
        if (currentLabel && Object.keys(currentLabel).length === 1 && currentLabel["default"].trim() === "") {
          delete updatedSurvey.questions[questionIdx][attribute];
        }
      }
    });
    setLocalSurvey(updatedSurvey);
    validateSurveyQuestion(updatedSurvey.questions[questionIdx]);
  };

  const deleteQuestion = (questionIdx: number) => {
    const questionId = localSurvey.questions[questionIdx].id;
    const activeQuestionIdTemp = activeQuestionId ?? localSurvey.questions[0].id;
    let updatedSurvey: TSurvey = { ...localSurvey };

    // check if we are recalling from this question for every language
    updatedSurvey.questions.forEach((question) => {
      for (const [languageCode, headline] of Object.entries(question.headline)) {
        if (headline.includes(`recall:${questionId}`)) {
          const recallInfo = extractRecallInfo(headline);
          if (recallInfo) {
            question.headline[languageCode] = headline.replace(recallInfo, "");
          }
        }
      }
    });
    updatedSurvey.questions.splice(questionIdx, 1);
    updatedSurvey = handleQuestionLogicChange(updatedSurvey, questionId, "");
    const firstEndingCard = localSurvey.endings[0];
    setLocalSurvey(updatedSurvey);
    delete internalQuestionIdMap[questionId];
    if (questionId === activeQuestionIdTemp) {
      if (questionIdx <= localSurvey.questions.length && localSurvey.questions.length > 0) {
        setActiveQuestionId(localSurvey.questions[questionIdx % localSurvey.questions.length].id);
      } else if (firstEndingCard) {
        setActiveQuestionId(firstEndingCard.id);
      }
    }
    toast.success("Question deleted.");
  };

  const duplicateQuestion = (questionIdx: number) => {
    const questionToDuplicate = structuredClone(localSurvey.questions[questionIdx]);

    const newQuestionId = createId();

    // create a copy of the question with a new id
    const duplicatedQuestion = {
      ...questionToDuplicate,
      id: newQuestionId,
    };

    // insert the new question right after the original one
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.questions.splice(questionIdx + 1, 0, duplicatedQuestion);

    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(newQuestionId);
    internalQuestionIdMap[newQuestionId] = createId();

    toast.success("Question duplicated.");
  };

  const addQuestion = (question: TSurveyQuestion, index?: number) => {
    const updatedSurvey = { ...localSurvey };
    if (backButtonLabel) {
      question.backButtonLabel = backButtonLabel;
    }

    const languageSymbols = extractLanguageCodes(localSurvey.languages);
    const updatedQuestion = addMultiLanguageLabels(question, languageSymbols);

    if (index) {
      updatedSurvey.questions.splice(index, 0, { ...updatedQuestion, isDraft: true });
    } else {
      updatedSurvey.questions.push({ ...updatedQuestion, isDraft: true });
    }

    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(question.id);
    internalQuestionIdMap[question.id] = createId();
  };

  const addEndingCard = (index: number) => {
    const updatedSurvey = structuredClone(localSurvey);
    const newEndingCard = getDefaultEndingCard(localSurvey.languages);

    updatedSurvey.endings.splice(index, 0, newEndingCard);

    setLocalSurvey(updatedSurvey);
  };

  const moveQuestion = (questionIndex: number, up: boolean) => {
    const newQuestions = Array.from(localSurvey.questions);
    const [reorderedQuestion] = newQuestions.splice(questionIndex, 1);
    const destinationIndex = up ? questionIndex - 1 : questionIndex + 1;
    newQuestions.splice(destinationIndex, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
    setLocalSurvey(updatedSurvey);
  };

  //useEffect to validate survey when changes are made to languages
  useEffect(() => {
    if (!invalidQuestions) return;
    let updatedInvalidQuestions: string[] = invalidQuestions;
    // Validate each question
    localSurvey.questions.forEach((question, index) => {
      updatedInvalidQuestions = validateSurveyQuestionsInBatch(
        question,
        updatedInvalidQuestions,
        surveyLanguages,
        index === 0
      );
    });

    if (JSON.stringify(updatedInvalidQuestions) !== JSON.stringify(invalidQuestions)) {
      setInvalidQuestions(updatedInvalidQuestions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey.languages, localSurvey.questions, localSurvey.endings, localSurvey.welcomeCard]);

  useEffect(() => {
    const questionWithEmptyFallback = checkForEmptyFallBackValue(localSurvey, selectedLanguageCode);
    if (questionWithEmptyFallback) {
      setActiveQuestionId(questionWithEmptyFallback.id);
      if (activeQuestionId === questionWithEmptyFallback.id) {
        toast.error("Fallback missing");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionId, setActiveQuestionId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const onQuestionCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    const newQuestions = Array.from(localSurvey.questions);
    const sourceIndex = newQuestions.findIndex((question) => question.id === active.id);
    const destinationIndex = newQuestions.findIndex((question) => question.id === over?.id);
    const [reorderedQuestion] = newQuestions.splice(sourceIndex, 1);
    newQuestions.splice(destinationIndex, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
    setLocalSurvey(updatedSurvey);
  };

  const onEndingCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const newEndings = Array.from(localSurvey.endings);
    const sourceIndex = newEndings.findIndex((ending) => ending.id === active.id);
    const destinationIndex = newEndings.findIndex((ending) => ending.id === over?.id);
    const [reorderedEndings] = newEndings.splice(sourceIndex, 1);
    newEndings.splice(destinationIndex, 0, reorderedEndings);
    const updatedSurvey = { ...localSurvey, endings: newEndings };
    setLocalSurvey(updatedSurvey);
  };

  return (
    <div className="mt-16 w-full px-5 py-4">
      <div className="mb-5 flex w-full flex-col gap-5">
        <EditWelcomeCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
          isInvalid={invalidQuestions ? invalidQuestions.includes("start") : false}
          setSelectedLanguageCode={setSelectedLanguageCode}
          selectedLanguageCode={selectedLanguageCode}
          attributeClasses={attributeClasses}
        />
      </div>

      <DndContext sensors={sensors} onDragEnd={onQuestionCardDragEnd} collisionDetection={closestCorners}>
        <QuestionsDroppable
          localSurvey={localSurvey}
          product={product}
          moveQuestion={moveQuestion}
          updateQuestion={updateQuestion}
          duplicateQuestion={duplicateQuestion}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          deleteQuestion={deleteQuestion}
          activeQuestionId={activeQuestionId}
          setActiveQuestionId={setActiveQuestionId}
          invalidQuestions={invalidQuestions}
          internalQuestionIdMap={internalQuestionIdMap}
          attributeClasses={attributeClasses}
          addQuestion={addQuestion}
          isFormbricksCloud={isFormbricksCloud}
        />
      </DndContext>

      <AddQuestionButton addQuestion={addQuestion} product={product} />
      <div className="mt-5 flex flex-col gap-5">
        <hr className="border-t border-dashed" />
        <DndContext sensors={sensors} onDragEnd={onEndingCardDragEnd} collisionDetection={closestCorners}>
          <SortableContext items={localSurvey.endings} strategy={verticalListSortingStrategy}>
            {localSurvey.endings.map((ending, index) => {
              return (
                <EditEndingCard
                  key={ending.id}
                  localSurvey={localSurvey}
                  endingCardIndex={index}
                  setLocalSurvey={setLocalSurvey}
                  setActiveQuestionId={setActiveQuestionId}
                  activeQuestionId={activeQuestionId}
                  isInvalid={invalidQuestions ? invalidQuestions.includes(ending.id) : false}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  selectedLanguageCode={selectedLanguageCode}
                  attributeClasses={attributeClasses}
                  plan={plan}
                  addEndingCard={addEndingCard}
                  isFormbricksCloud={isFormbricksCloud}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        <AddEndingCardButton
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          addEndingCard={addEndingCard}
        />
        <hr />

        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
        />

        {/* <SurveyVariablesCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={activeQuestionId}
          setActiveQuestionId={setActiveQuestionId}
        /> */}

        <MultiLanguageCard
          localSurvey={localSurvey}
          product={product}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          isFormbricksCloud={isFormbricksCloud}
          setSelectedLanguageCode={setSelectedLanguageCode}
        />
      </div>
    </div>
  );
};
