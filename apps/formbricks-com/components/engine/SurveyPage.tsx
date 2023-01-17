import clsx from "clsx";
import { useEffect, useState } from "react";
import Button from "../shared/Button";
import { SurveyPage } from "./engineTypes";

interface SurveyProps {
  page: SurveyPage;
  onSubmit: () => void;
  submission: any;
  setSubmission: (v: any) => void;
}

export function SurveyPage({ page, onSubmit, submission, setSubmission }: SurveyProps) {
  const [submittingPage, setSubmittingPage] = useState(false);

  useEffect(() => {
    if (submittingPage) {
      setTimeout(() => {
        setSubmittingPage(false);
        onSubmit();
      }, 1000);
    }
  }, [submittingPage, onSubmit]);

  const handleSubmitQuestion = () => {
    if (page.config?.autoSubmit && page.questions.length == 1) {
      setSubmittingPage(true);
    }
  };

  const getField = (pageId: string) => {
    if (!(pageId in submission)) return null;
    return submission[pageId];
  };

  const setField = (field: string, fieldSubmission: any) => {
    setSubmission({ ...submission, [field]: fieldSubmission });
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-8">
        {page.questions.map((question) => {
          const QuestionComponent = question.component;
          return (
            <div key={question.id} className={clsx(submittingPage && "animate-pulse")}>
              <QuestionComponent
                question={question}
                value={getField(question.id)}
                setValue={(v: any) => setField(question.id, v)}
                onSubmit={() => handleSubmitQuestion()}
              />
            </div>
          );
        })}
      </div>
      {!(page.config?.autoSubmit && page.questions.length == 1) && (
        <div className="my-8 flex w-full justify-end">
          <Button variant="primary" onClick={() => setSubmittingPage(true)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
