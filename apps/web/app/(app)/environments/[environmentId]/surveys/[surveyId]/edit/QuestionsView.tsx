"use client";

import type { Survey } from "@formbricks/types/surveys";
import { createId } from "@paralleldrive/cuid2";
import { useMemo, useState } from "react";
import { DragDropContext } from "react-beautiful-dnd";
import toast from "react-hot-toast";
import AddQuestionButton from "./AddQuestionButton";
import EditThankYouCard from "./EditThankYouCard";
import QuestionCard from "./QuestionCard";
import { StrictModeDroppable } from "./StrictModeDroppable";
import { Question } from "@formbricks/types/questions";
import { validateQuestion } from "./Validation";

interface QuestionsViewProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  environmentId: string;
  invalidQuestions: String[] | null;
  setInvalidQuestions: (invalidQuestions: String[] | null) => void;
}

export default function QuestionsView({
  activeQuestionId,
  setActiveQuestionId,
  localSurvey,
  setLocalSurvey,
  environmentId,
  invalidQuestions,
  setInvalidQuestions,
}: QuestionsViewProps) {
  const internalQuestionIdMap = useMemo(() => {
    return localSurvey.questions.reduce((acc, question) => {
      acc[question.id] = createId();
      return acc;
    }, {});
  }, []);

  const [backButtonLabel, setbackButtonLabel] = useState(null);

  const handleQuestionLogicChange = (survey: Survey, compareId: string, updatedId: string): Survey => {
    survey.questions.forEach((question) => {
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
  const validateSurvey = (question: Question) => {
    // prevent this function to execute further if user hasnt still tried to save the survey
    if (invalidQuestions === null) {
      return;
    }
    let temp = JSON.parse(JSON.stringify(invalidQuestions));
    if (validateQuestion(question)) {
      temp = invalidQuestions.filter((id) => id !== question.id);
      setInvalidQuestions(temp);
    } else if (!invalidQuestions.includes(question.id)) {
      temp.push(question.id);
      setInvalidQuestions(temp);
    }
  };

  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    let updatedSurvey = JSON.parse(JSON.stringify(localSurvey));

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
    validateSurvey(updatedSurvey.questions[questionIdx]);
  };

  const deleteQuestion = (questionIdx: number) => {
    const questionId = localSurvey.questions[questionIdx].id;
    let updatedSurvey: Survey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.splice(questionIdx, 1);

    updatedSurvey = handleQuestionLogicChange(updatedSurvey, questionId, "end");

    setLocalSurvey(updatedSurvey);
    delete internalQuestionIdMap[questionId];

    if (questionId === activeQuestionId) {
      if (questionIdx < localSurvey.questions.length - 1) {
        setActiveQuestionId(localSurvey.questions[questionIdx + 1].id);
      } else if (localSurvey.thankYouCard.enabled) {
        setActiveQuestionId("thank-you-card");
      } else {
        setActiveQuestionId(localSurvey.questions[questionIdx - 1].id);
      }
    }
    toast.success("Question deleted.");
  };

  const duplicateQuestion = (questionIdx: number) => {
    const questionToDuplicate = JSON.parse(JSON.stringify(localSurvey.questions[questionIdx]));
    const newQuestionId = createId();

    // create a copy of the question with a new id
    const duplicatedQuestion = {
      ...questionToDuplicate,
      id: newQuestionId,
    };

    // insert the new question right after the original one
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.splice(questionIdx + 1, 0, duplicatedQuestion);

    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(newQuestionId);
    internalQuestionIdMap[newQuestionId] = createId();

    toast.success("Question duplicated.");
  };

  const addQuestion = (question: any) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    if (backButtonLabel) {
      question.backButtonLabel = backButtonLabel;
    }
    updatedSurvey.questions.push({ ...question, isDraft: true });
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
    // move the question up or down in the localSurvey questions array
    const newQuestions = Array.from(localSurvey.questions);
    const [reorderedQuestion] = newQuestions.splice(questionIndex, 1);
    const destinationIndex = up ? questionIndex - 1 : questionIndex + 1;
    newQuestions.splice(destinationIndex, 0, reorderedQuestion);
    const updatedSurvey = { ...localSurvey, questions: newQuestions };
    setLocalSurvey(updatedSurvey);
  };

  return (
    <div className="mt-12 px-5 py-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mb-5 grid grid-cols-1 gap-5 ">
          <StrictModeDroppable droppableId="questionsList">
            {(provided) => (
              <div className="grid gap-5" ref={provided.innerRef} {...provided.droppableProps}>
                {localSurvey.questions.map((question, questionIdx) => (
                  // display a question form
                  <QuestionCard
                    key={internalQuestionIdMap[question.id]}
                    localSurvey={localSurvey}
                    questionIdx={questionIdx}
                    moveQuestion={moveQuestion}
                    updateQuestion={updateQuestion}
                    duplicateQuestion={duplicateQuestion}
                    deleteQuestion={deleteQuestion}
                    activeQuestionId={activeQuestionId}
                    setActiveQuestionId={setActiveQuestionId}
                    lastQuestion={questionIdx === localSurvey.questions.length - 1}
                    isInValid={invalidQuestions ? invalidQuestions.includes(question.id) : false}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </StrictModeDroppable>
        </div>
      </DragDropContext>
      <AddQuestionButton addQuestion={addQuestion} environmentId={environmentId} />
      <div className="mt-5">
        <EditThankYouCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setActiveQuestionId={setActiveQuestionId}
          activeQuestionId={activeQuestionId}
        />
      </div>
    </div>
  );
}
