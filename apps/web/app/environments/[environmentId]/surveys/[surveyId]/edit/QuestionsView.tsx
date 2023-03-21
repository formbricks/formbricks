"use client";

import { DragDropContext } from "react-beautiful-dnd";
import AddQuestionButton from "./AddQuestionButton";
import QuestionCard from "./QuestionCard";
import { StrictModeDroppable } from "./StrictModeDroppable";

interface QuestionsViewProps {
  questions: any[];
  setQuestions: (questions: any[]) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export default function QuestionsView({
  questions,
  setQuestions,
  activeQuestionId,
  setActiveQuestionId,
}: QuestionsViewProps) {
  const updateQuestion = (questionIdx: number, updatedAttributes: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIdx] = {
      ...updatedQuestions[questionIdx],
      ...updatedAttributes,
    };
    setQuestions(updatedQuestions);
  };

  const deleteQuestion = (questionIdx: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(questionIdx, 1);
    setQuestions(updatedQuestions);
  };

  const addQuestion = (question: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions.push(question);
    setQuestions(updatedQuestions);
    setActiveQuestionId(question.id);
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setQuestions(items);
  };

  return (
    <div className="px-5 py-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mb-5 grid grid-cols-1 gap-5 ">
          <StrictModeDroppable droppableId="questionsList">
            {(provided) => (
              <div className="grid gap-5" ref={provided.innerRef} {...provided.droppableProps}>
                {questions.map((question, questionIdx) => (
                  // display a question form
                  <QuestionCard
                    key={question.id}
                    question={question}
                    questionIdx={questionIdx}
                    updateQuestion={updateQuestion}
                    deleteQuestion={deleteQuestion}
                    activeQuestionId={activeQuestionId}
                    setActiveQuestionId={setActiveQuestionId}
                    lastQuestion={questionIdx === questions.length - 1}
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
