import Modal from "@/components/preview/Modal";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import { useEnvironment } from "@/lib/environments/environments";
import type { Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { useEffect, useState } from "react";

interface PreviewSurveyProps {
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  questions: Question[];
  brandColor: string;
  environmentId: string;
  surveyType: Survey["type"];
  thankYouCard: Survey["thankYouCard"];
  previewType?: "modal" | "fullwidth" | "email";
}

export default function PreviewSurvey({
  setActiveQuestionId,
  activeQuestionId,
  questions,
  brandColor,
  environmentId,
  surveyType,
  thankYouCard,
  previewType,
}: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const { environment } = useEnvironment(environmentId);
  const [lastActiveQuestionId, setLastActiveQuestionId] = useState("");

  useEffect(() => {
    if (activeQuestionId) {
      setLastActiveQuestionId(activeQuestionId);
      setProgress(calculateProgress(questions, activeQuestionId));
    } else if (lastActiveQuestionId) {
      setProgress(calculateProgress(questions, lastActiveQuestionId));
    }

    function calculateProgress(questions, id) {
      const elementIdx = questions.findIndex((e) => e.id === id);
      return elementIdx / questions.length;
    }
  }, [activeQuestionId, lastActiveQuestionId, questions]);

  useEffect(() => {
    // close modal if there are no questions left
    if (surveyType === "web" && !thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, surveyType, questions, setActiveQuestionId, thankYouCard]);

  const gotoNextQuestion = () => {
    const currentQuestionId = activeQuestionId || lastActiveQuestionId;
    const currentIndex = questions.findIndex((q) => q.id === currentQuestionId);

    if (currentIndex < questions.length - 1) {
      setActiveQuestionId(questions[currentIndex + 1].id);
    } else {
      if (thankYouCard?.enabled) {
        setActiveQuestionId("thank-you-card");
      } else {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(questions[0].id);
          setIsModalOpen(true);
        }, 500);
        if (thankYouCard?.enabled) {
          setActiveQuestionId("thank-you-card");
          setProgress(1);
        } else {
          setIsModalOpen(false);
          setTimeout(() => {
            setActiveQuestionId(questions[0].id);
            setIsModalOpen(true);
          }, 500);
        }
      }
    }
  };

  /*  const resetPreview = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setActiveQuestionId(questions[0].id);
      setIsModalOpen(true);
    }, 500);
  };
 */

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  if (!previewType) {
    previewType = widgetSetupCompleted ? "modal" : "fullwidth";
  }

  return (
    <div className="my-4 flex h-full w-5/6 flex-col rounded-lg border border-slate-300 bg-slate-200 ">
      <div className="flex h-8 items-center rounded-t-lg bg-slate-100">
        <div className="ml-6 flex space-x-2">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <div className="h-3 w-3 rounded-full bg-amber-500"></div>
          <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
        </div>
        <p>
          {previewType === "modal" && <p className="ml-4 font-mono text-sm text-slate-400">Your web app</p>}
        </p>
      </div>

      {previewType === "modal" ? (
        <Modal isOpen={isModalOpen}>
          {(activeQuestionId || lastActiveQuestionId) === "thank-you-card" ? (
            <ThankYouCard
              brandColor={brandColor}
              headline={thankYouCard?.headline || "Thank you!"}
              subheader={thankYouCard?.subheader || "We appreciate your feedback."}
            />
          ) : (
            questions.map((question, idx) =>
              (activeQuestionId || lastActiveQuestionId) === question.id ? (
                <QuestionConditional
                  key={question.id}
                  question={question}
                  brandColor={brandColor}
                  lastQuestion={idx === questions.length - 1}
                  onSubmit={gotoNextQuestion}
                />
              ) : null
            )
          )}
        </Modal>
      ) : (
        <div className="flex flex-grow flex-col">
          <div className="flex w-full flex-grow flex-col items-center justify-center bg-white">
            <div className="w-full max-w-md">
              {(activeQuestionId || lastActiveQuestionId) === "thank-you-card" ? (
                <ThankYouCard
                  brandColor={brandColor}
                  headline={thankYouCard?.headline || "Thank you!"}
                  subheader={thankYouCard?.subheader || "We appreciate your feedback."}
                />
              ) : (
                questions.map((question, idx) =>
                  (activeQuestionId || lastActiveQuestionId) === question.id ? (
                    <QuestionConditional
                      key={question.id}
                      question={question}
                      brandColor={brandColor}
                      lastQuestion={idx === questions.length - 1}
                      onSubmit={gotoNextQuestion}
                    />
                  ) : null
                )
              )}
            </div>
          </div>
          <div className="z-10 w-full rounded-b-lg bg-white">
            <div className="mx-auto max-w-md p-6 pt-4">
              <Progress progress={progress} brandColor={brandColor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
