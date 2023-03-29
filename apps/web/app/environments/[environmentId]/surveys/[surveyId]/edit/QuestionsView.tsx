"use client";

import type { Survey } from "@formbricks/types/surveys";
import { DragDropContext } from "react-beautiful-dnd";
import AddQuestionButton from "./AddQuestionButton";
import QuestionCard from "./QuestionCard";
import { StrictModeDroppable } from "./StrictModeDroppable";

interface QuestionsViewProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export default function QuestionsView({
  activeQuestionId,
  setActiveQuestionId,
  localSurvey,
  setLocalSurvey,
}: QuestionsViewProps) {
  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions[questionIdx] = {
      ...updatedSurvey.questions[questionIdx],
      ...updatedAttributes,
    };
    setLocalSurvey(updatedSurvey);
  };

  const deleteQuestion = (questionIdx: number) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.splice(questionIdx, 1);
    setLocalSurvey(updatedSurvey);
  };

  const addQuestion = (question: any) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.questions.push(question);
    setLocalSurvey(updatedSurvey);
    setActiveQuestionId(question.id);
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
                    key={question.id}
                    question={question}
                    questionIdx={questionIdx}
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
      <AddQuestionButton addQuestion={addQuestion} />
    </div>
  );
}
