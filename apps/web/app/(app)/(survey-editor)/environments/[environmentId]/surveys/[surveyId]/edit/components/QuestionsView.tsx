"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createId } from "@paralleldrive/cuid2";
import React, { SetStateAction, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MultiLanguageCard } from "@formbricks/ee/multi-language/components/multi-language-card";
import { extractLanguageCodes, getLocalizedValue, translateQuestion } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { checkForEmptyFallBackValue, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  findQuestionsWithCyclicLogic,
  isCardValid,
  validateQuestion,
  validateSurveyQuestionsInBatch,
} from "../lib/validation";
import { AddQuestionButton } from "./AddQuestionButton";
import { EditThankYouCard } from "./EditThankYouCard";
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
  setInvalidQuestions: (invalidQuestions: string[] | null) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  attributeClasses: TAttributeClass[];
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

  // function to validate individual questions
  const validateSurveyQuestion = (question: TSurveyQuestion) => {
    // prevent this function to execute further if user hasnt still tried to save the survey
    if (invalidQuestions === null) {
      return;
    }
    const isFirstQuestion = question.id === localSurvey.questions[0].id;
    let temp = structuredClone(invalidQuestions);
    if (validateQuestion(question, surveyLanguages, isFirstQuestion)) {
      // If question is valid, we now check for cyclic logic
      const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(localSurvey.questions);
      if (!questionsWithCyclicLogic.includes(question.id)) {
        temp = invalidQuestions.filter((id) => id !== question.id);
        setInvalidQuestions(temp);
      }
    } else if (!invalidQuestions.includes(question.id)) {
      temp.push(question.id);
      setInvalidQuestions(temp);
    }
  };

  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    let updatedSurvey = { ...localSurvey };
    if ("id" in updatedAttributes) {
      // if the survey whose id is to be changed is linked to logic of any other survey then changing it
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

    // check if we are recalling from this question
    updatedSurvey.questions.forEach((question) => {
      if (question.headline[selectedLanguageCode].includes(`recall:${questionId}`)) {
        const recallInfo = extractRecallInfo(getLocalizedValue(question.headline, selectedLanguageCode));
        if (recallInfo) {
          question.headline[selectedLanguageCode] = question.headline[selectedLanguageCode].replace(
            recallInfo,
            ""
          );
        }
      }
    });
    updatedSurvey.questions.splice(questionIdx, 1);
    updatedSurvey = handleQuestionLogicChange(updatedSurvey, questionId, "end");
    setLocalSurvey(updatedSurvey);
    delete internalQuestionIdMap[questionId];
    if (questionId === activeQuestionIdTemp) {
      if (questionIdx <= localSurvey.questions.length && localSurvey.questions.length > 0) {
        setActiveQuestionId(localSurvey.questions[questionIdx % localSurvey.questions.length].id);
      } else if (localSurvey.thankYouCard.enabled) {
        setActiveQuestionId("end");
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

  const addQuestion = (question: any, index?: number) => {
    const updatedSurvey = { ...localSurvey };
    if (backButtonLabel) {
      question.backButtonLabel = backButtonLabel;
    }
    const languageSymbols = extractLanguageCodes(localSurvey.languages);
    const translatedQuestion = translateQuestion(question, languageSymbols);

    if (index) {
      updatedSurvey.questions.splice(index, 0, { ...translatedQuestion, isDraft: true });
    } else {
      updatedSurvey.questions.push({ ...translatedQuestion, isDraft: true });
    }

    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(question.id);
    internalQuestionIdMap[question.id] = createId();
  };

  const moveQuestion = (questionIndex: number, up: boolean) => {
    const newQuestions = Array.from(localSurvey.questions);
    const [reorderedQuestion] = newQuestions.splice(questionIndex, 1);
    const destinationIndex = up ? questionIndex - 1 : questionIndex + 1;
    newQuestions.splice(destinationIndex, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
    setLocalSurvey(updatedSurvey);
  };

  useEffect(() => {
    if (invalidQuestions === null) return;

    const updateInvalidQuestions = (card, cardId, currentInvalidQuestions) => {
      if (card.enabled && !isCardValid(card, cardId, surveyLanguages)) {
        return currentInvalidQuestions.includes(cardId)
          ? currentInvalidQuestions
          : [...currentInvalidQuestions, cardId];
      }
      return currentInvalidQuestions.filter((id) => id !== cardId);
    };

    const updatedQuestionsStart = updateInvalidQuestions(localSurvey.welcomeCard, "start", invalidQuestions);
    const updatedQuestionsEnd = updateInvalidQuestions(
      localSurvey.thankYouCard,
      "end",
      updatedQuestionsStart
    );

    setInvalidQuestions(updatedQuestionsEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey.welcomeCard, localSurvey.thankYouCard]);

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

    // Check welcome card
    if (localSurvey.welcomeCard.enabled && !isCardValid(localSurvey.welcomeCard, "start", surveyLanguages)) {
      if (!updatedInvalidQuestions.includes("start")) {
        updatedInvalidQuestions.push("start");
      }
    } else {
      updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== "start");
    }

    // Check thank you card
    if (localSurvey.thankYouCard.enabled && !isCardValid(localSurvey.thankYouCard, "end", surveyLanguages)) {
      if (!updatedInvalidQuestions.includes("end")) {
        updatedInvalidQuestions.push("end");
      }
    } else {
      updatedInvalidQuestions = updatedInvalidQuestions.filter((questionId) => questionId !== "end");
    }

    if (JSON.stringify(updatedInvalidQuestions) !== JSON.stringify(invalidQuestions)) {
      setInvalidQuestions(updatedInvalidQuestions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey.languages, localSurvey.questions]);

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

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    const newQuestions = Array.from(localSurvey.questions);
    const sourceIndex = newQuestions.findIndex((question) => question.id === active.id);
    const destinationIndex = newQuestions.findIndex((question) => question.id === over?.id);
    const [reorderedQuestion] = newQuestions.splice(sourceIndex, 1);
    newQuestions.splice(destinationIndex, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
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

      <DndContext sensors={sensors} onDragEnd={onDragEnd} collisionDetection={closestCorners}>
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
        <EditThankYouCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
          isInvalid={invalidQuestions ? invalidQuestions.includes("end") : false}
          setSelectedLanguageCode={setSelectedLanguageCode}
          selectedLanguageCode={selectedLanguageCode}
          attributeClasses={attributeClasses}
        />

        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
        />

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
