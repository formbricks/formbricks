import clsx from "clsx";
import { useEffect, useState } from "react";
import Button from "../shared/Button";
import { SurveyPage } from "./engineTypes";

interface SurveyProps {
  page: SurveyPage;
  onSubmit: () => void;
  submission: any;
  setSubmission: (v: any) => void;
  finished: boolean;
}

export function SurveyPage({ page, onSubmit, submission, setSubmission, finished }: SurveyProps) {
  const [submittingPage, setSubmittingPage] = useState(false);

  useEffect(() => {
    if (submittingPage) {
      setTimeout(() => {
        setSubmittingPage(false);
        onSubmit();
      }, 1000);
    }
  }, [submittingPage, onSubmit]);

  const handleSubmitElement = () => {
    if (page.config?.autoSubmit && page.elements.length == 1) {
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
    <>
      <div className="grid grid-cols-1 gap-8">
        {page.elements.map((element) => {
          const ElementComponent = element.component;
          return (
            <div key={element.id} className={clsx(submittingPage && "animate-pulse")}>
              <ElementComponent
                element={element}
                value={getField(element.id)}
                setValue={(v: any) => setField(element.id, v)}
                onSubmit={() => handleSubmitElement()}
              />
            </div>
          );
        })}
      </div>
      {!finished && !(page.config?.autoSubmit && page.elements.length == 1) && (
        <div className="my-8 flex w-full justify-end">
          <Button variant="primary" onClick={() => setSubmittingPage(true)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}
