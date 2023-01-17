import { Transition } from "@headlessui/react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import Button from "../shared/Button";
import { Survey } from "./engineTypes";
import Progressbar from "./Progressbar";
import { SurveyPage } from "./SurveyPage";

interface SurveyProps {
  survey: Survey;
}

export function Survey({ survey }: SurveyProps) {
  const [currentPage, setCurrentPage] = useState(survey.pages[0]);
  const [progress, setProgress] = useState(0);
  const [submission, setSubmission] = useState<any>({});
  const [submittingPage, setSubmittingPage] = useState(false);
  const [submitPage, setSubmitPage] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (submittingPage) {
      setTimeout(() => {
        setSubmittingPage(false);
        setSubmitPage(true);
      }, 1000);
    }
  }, [submittingPage]);

  const onPageSubmit = () => {
    const currentPageIdx = survey.pages.findIndex((p) => p.id === currentPage.id);
    if (currentPageIdx === survey.pages.length - 1) {
      console.log("submission complete", JSON.stringify(submission));
      setProgress(1);
      setFinished(true);
    } else {
      setCurrentPage(survey.pages[currentPageIdx + 1]);
      setProgress((currentPageIdx + 1) / survey.pages.length);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div></div>
      {finished ? (
        <div className="text-white">Done</div>
      ) : (
        <SurveyPage
          page={currentPage}
          onSubmit={() => onPageSubmit()}
          submission={submission}
          setSubmission={setSubmission}
        />
      )}

      <div className="h-3">
        <Progressbar progress={progress} />
      </div>
    </div>
  );
}
