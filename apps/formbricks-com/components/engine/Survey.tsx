import { useEffect, useMemo, useState } from "react";
import { Survey } from "./engineTypes";
import Progressbar from "./Progressbar";
import { SurveyPage } from "./SurveyPage";

interface SurveyProps {
  survey: Survey;
  formbricksUrl: string;
  formId: string;
}

export function Survey({ survey, formbricksUrl, formId }: SurveyProps) {
  const [currentPage, setCurrentPage] = useState(survey.pages[0]);
  const [progress, setProgress] = useState(0);
  const [submission, setSubmission] = useState<any>({});
  const [finished, setFinished] = useState(false);

  const schema = useMemo(() => generateSchema(survey), [survey]);

  const onPageSubmit = (updatedSubmission: any) => {
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
          if (rule.value === submission[rule.name]) {
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
      {!(survey.config?.progressBar === false) && (
        <div className="mb-8 h-3">
          <Progressbar progress={progress} />
        </div>
      )}

      <SurveyPage
        page={currentPage}
        onSubmit={onPageSubmit}
        submission={submission}
        setSubmission={setSubmission}
        finished={finished}
        formbricksUrl={formbricksUrl}
        formId={formId}
        schema={schema}
      />
    </div>
  );
}

function generateSchema(survey: Survey) {
  const schema: any = JSON.parse(JSON.stringify(survey));
  deleteProps(schema, "frontend");
  return schema;
}

function deleteProps(obj: any, propName: string) {
  if (Array.isArray(obj)) {
    for (let v of obj) {
      if (v instanceof Object) {
        deleteProps(v, propName);
      }
    }
    return;
  }
  delete obj[propName];
  for (let v of Object.values(obj)) {
    if (v instanceof Object) {
      deleteProps(v, propName);
    }
  }
}
