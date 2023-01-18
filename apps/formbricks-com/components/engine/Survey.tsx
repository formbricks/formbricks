import { useEffect, useState } from "react";
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
  const [finished, setFinished] = useState(false);

  const onPageSubmit = (updatedSubmission: any) => {
    console.log("current submission state", JSON.stringify(updatedSubmission, null, 2));
    const nextPage = calculateNextPage(survey, updatedSubmission);
    setCurrentPage(nextPage);
    if (nextPage.endScreen) {
      setFinished(true);
      setProgress(1);
    } else {
      const nextPageIdx = survey.pages.findIndex((p) => p.id === nextPage.id);
      setProgress(nextPageIdx / survey.pages.length);
    }
  };

  const calculateNextPage = (survey: Survey, submission: any) => {
    if (currentPage.branchingRules) {
      for (const rule of currentPage.branchingRules) {
        if (rule.type === "value") {
          if (rule.value === submission[rule.field]) {
            const nextPage = survey.pages.find((p) => p.id === rule.nextPageId);
            if (!nextPage) {
              throw new Error(`Next page ${rule.nextPageId} not found`);
            }
            return nextPage;
          }
        }
      }
    }
    const currentPageIdx = survey.pages.findIndex((p) => p.id === currentPage.id);
    return survey.pages[currentPageIdx + 1];
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-8 h-3">
        <Progressbar progress={progress} />
      </div>
      <SurveyPage
        page={currentPage}
        onSubmit={onPageSubmit}
        submission={submission}
        setSubmission={setSubmission}
        finished={finished}
      />
    </div>
  );
}
