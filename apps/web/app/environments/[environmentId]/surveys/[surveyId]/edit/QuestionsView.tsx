"use client";

import type { Survey } from "@formbricks/types/surveys";
import { DragDropContext } from "react-beautiful-dnd";
import AddQuestionButton from "./AddQuestionButton";
import QuestionCard from "./QuestionCard";
import { StrictModeDroppable } from "./StrictModeDroppable";
import EditThankYouCard from "./EditThankYouCard";
import { createId } from "@paralleldrive/cuid2";
import { useMemo } from "react";

interface QuestionsViewProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  environmentId: string;
}

export default function QuestionsView({
  activeQuestionId,
  setActiveQuestionId,
  localSurvey,
  setLocalSurvey,
  environmentId,
}: QuestionsViewProps) {
  const internalQuestionIdMap = useMemo(() => {
    return localSurvey.questions.reduce((acc, question) => {
      acc[question.id] = createId();
      return acc;
    }, {});
  }, []);

  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions[questionIdx] = {
      ...updatedSurvey.questions[questionIdx],
      ...updatedAttributes,
    };
    setLocalSurvey(updatedSurvey);
    if ("id" in updatedAttributes) {
      // relink the question to internal Id
      internalQuestionIdMap[updatedAttributes.id] =
        internalQuestionIdMap[localSurvey.questions[questionIdx].id];
      delete internalQuestionIdMap[localSurvey.questions[questionIdx].id];
      setActiveQuestionId(updatedAttributes.id);
    }
  };

  const deleteQuestion = (questionIdx: number) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.splice(questionIdx, 1);
    setLocalSurvey(updatedSurvey);
    delete internalQuestionIdMap[localSurvey.questions[questionIdx].id];
  };

  const addQuestion = (question: any) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.push(question);
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
    <div className="px-5 py-4">
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
                    question={question}
                    questionIdx={questionIdx}
                    moveQuestion={moveQuestion}
                    updateQuestion={updateQuestion}
                    deleteQuestion={deleteQuestion}
                    activeQuestionId={activeQuestionId}
                    setActiveQuestionId={setActiveQuestionId}
                    lastQuestion={questionIdx === localSurvey.questions.length - 1}
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
