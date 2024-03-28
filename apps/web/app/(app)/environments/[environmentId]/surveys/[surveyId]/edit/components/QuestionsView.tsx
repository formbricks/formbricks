"use client";

import HiddenFieldsCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/HiddenFieldsCard";
import {
  isCardValid,
  validateQuestion,
  validateSurveyQuestionsInBatch,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { createId } from "@paralleldrive/cuid2";
import { useEffect, useMemo, useState } from "react";
import { DragDropContext } from "react-beautiful-dnd";
import toast from "react-hot-toast";

import { MultiLanguageCard } from "@formbricks/ee/multiLanguage/components/MultiLanguageCard";
import { extractLanguageCodes, getLocalizedValue, translateQuestion } from "@formbricks/lib/i18n/utils";
import { checkForEmptyFallBackValue, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

import AddQuestionButton from "./AddQuestionButton";
import EditThankYouCard from "./EditThankYouCard";
import EditWelcomeCard from "./EditWelcomeCard";
import QuestionCard from "./QuestionCard";
import { StrictModeDroppable } from "./StrictModeDroppable";

interface QuestionsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  product: TProduct;
  invalidQuestions: string[] | null;
  setInvalidQuestions: (invalidQuestions: string[] | null) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
}

export default function QuestionsView({
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
}: QuestionsViewProps) {
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
    let temp = structuredClone(invalidQuestions);
    if (validateQuestion(question, surveyLanguages)) {
      temp = invalidQuestions.filter((id) => id !== question.id);
      setInvalidQuestions(temp);
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
      updatedSurvey.questions.forEach((question) => {
        question.backButtonLabel = updatedAttributes.backButtonLabel;
      });
      setbackButtonLabel(updatedAttributes.backButtonLabel);
    }
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

  const addQuestion = (question: any) => {
    const updatedSurvey = { ...localSurvey };
    if (backButtonLabel) {
      question.backButtonLabel = backButtonLabel;
    }
    const languageSymbols = extractLanguageCodes(localSurvey.languages);
    const translatedQuestion = translateQuestion(question, languageSymbols);
    updatedSurvey.questions.push({ ...translatedQuestion, isDraft: true });

    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(question.id);
    internalQuestionIdMap[question.id] = createId();
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }
    const newQuestions = Array.from(localSurvey.questions);
    const [reorderedQuestion] = newQuestions.splice(result.source.index, 1);
    newQuestions.splice(result.destination.index, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
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
    localSurvey.questions.forEach((question) => {
      updatedInvalidQuestions = validateSurveyQuestionsInBatch(
        question,
        updatedInvalidQuestions,
        surveyLanguages
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

  return (
    <div className="mt-16 px-5 py-4">
      <div className="mb-5 flex flex-col gap-5">
        <EditWelcomeCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
          isInvalid={invalidQuestions ? invalidQuestions.includes("start") : false}
          setSelectedLanguageCode={setSelectedLanguageCode}
          selectedLanguageCode={selectedLanguageCode}
        />
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mb-5 grid grid-cols-1 gap-5 ">
          <StrictModeDroppable droppableId="questionsList">
            {(provided) => (
              <div className="grid w-full gap-5" ref={provided.innerRef} {...provided.droppableProps}>
                {localSurvey.questions.map((question, questionIdx) => (
                  // display a question form
                  <QuestionCard
                    key={internalQuestionIdMap[question.id]}
                    localSurvey={localSurvey}
                    product={product}
                    questionIdx={questionIdx}
                    moveQuestion={moveQuestion}
                    updateQuestion={updateQuestion}
                    duplicateQuestion={duplicateQuestion}
                    selectedLanguageCode={selectedLanguageCode}
                    setSelectedLanguageCode={setSelectedLanguageCode}
                    deleteQuestion={deleteQuestion}
                    activeQuestionId={activeQuestionId}
                    setActiveQuestionId={setActiveQuestionId}
                    lastQuestion={questionIdx === localSurvey.questions.length - 1}
                    isInvalid={invalidQuestions ? invalidQuestions.includes(question.id) : false}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </StrictModeDroppable>
        </div>
      </DragDropContext>
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
        />

        {localSurvey.type === "link" ? (
          <HiddenFieldsCard
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            setActiveQuestionId={setActiveQuestionId}
            activeQuestionId={activeQuestionId}
          />
        ) : null}

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
}
