"use client";

import { useEffect, useState } from "react";
import AddQuestionButton from "./AddQuestionButton";
import QuestionCard from "./QuestionCard";
import QuestionsAudienceTabs from "./QuestionsAudienceTabs";
import SurveyMenuBar from "./SurveyMenuBar";
import { DragDropContext } from "react-beautiful-dnd";
import { StrictModeDroppable } from "./StrictModeDroppable";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Question } from "@/types/questions";

interface SurveyEditorProps {
  environmentId: string;
  surveyId: string;
}

export default function SurveyEditor({ environmentId, surveyId }: SurveyEditorProps) {
  const [activeView, setActiveView] = useState<"questions" | "audience">("questions");
  const [questions, setQuestions] = useState<Question[]>([]);

  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  useEffect(() => {
    if (survey) {
      setQuestions(survey.questions);
    }
  }, [survey]);

  if (isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey) {
    return <div>Error</div>;
  }

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
    <div className="h-full">
      <SurveyMenuBar />
      <div className="relative z-0 flex h-full flex-1 overflow-hidden">
        <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
          <QuestionsAudienceTabs activeId={activeView} setActiveId={setActiveView} />
          {activeView === "questions" ? (
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
          ) : (
            <div>audience</div>
          )}
        </main>
        <aside className="relative hidden h-full w-96 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-200 shadow-inner xl:flex xl:flex-col">
          preview
        </aside>
      </div>
    </div>
  );
}
