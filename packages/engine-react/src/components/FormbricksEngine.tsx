import { useEffect, useMemo, useState } from "react";
import { Form } from "../types";
import { EnginePage } from "./EnginePage";

interface FormProps {
  schema: Form;
  formbricksUrl?: string;
  formId?: string;
  customer?: any;
  onFinished?: ({ submission }: any) => void;
  onPageSubmit?: ({ page }: any) => void;
  offline?: boolean;
}

export function FormbricksEngine({
  schema,
  formbricksUrl,
  formId,
  customer = {},
  onFinished = () => {},
  onPageSubmit = () => {},
  offline = false,
}: FormProps) {
  if (!schema) {
    console.error("Formbricks Engine: No form provided");
    return null;
  }

  const [currentPage, setCurrentPage] = useState(schema.pages[0]);
  const [submission, setSubmission] = useState<any>({});
  const [finished, setFinished] = useState(false);

  const cleanedSchema = useMemo(() => generateSchema(schema), [schema]);

  useEffect(() => {
    // warmup request
    fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions`, {
      method: "OPTIONS",
    });
  }, []);

  const navigateToNextPage = (currentSubmission: any) => {
    const nextPage = calculateNextPage(schema, currentSubmission);
    setCurrentPage(nextPage);
    if (nextPage.endScreen) {
      setFinished(true);
    }
  };

  const calculateNextPage = (Form: Form, submission: any) => {
    if (currentPage.branchingRules) {
      for (const rule of currentPage.branchingRules) {
        if (rule.type === "value") {
          if (rule.value === submission[rule.name]) {
            const nextPage = Form.pages.find((p) => p.id === rule.nextPageId);
            if (!nextPage) {
              throw new Error(`Next page ${rule.nextPageId} not found`);
            }
            return nextPage;
          }
        }
      }
    }
    const currentPageIdx = Form.pages.findIndex((p) => p.id === currentPage.id);
    return Form.pages[currentPageIdx + 1];
  };

  return (
    <div>
      <EnginePage
        page={currentPage}
        onSkip={() => navigateToNextPage(submission)}
        onPageSubmit={({ submission, page, pageSubmission }: any) => {
          navigateToNextPage(submission);
          onPageSubmit({ submission, page, pageSubmission });
        }}
        onFinished={onFinished}
        submission={submission}
        setSubmission={setSubmission}
        finished={finished}
        formbricksUrl={formbricksUrl}
        formId={formId}
        schema={cleanedSchema}
        customer={customer}
        offline={offline}
      />
    </div>
  );
}

function generateSchema(Form: Form) {
  const schema: any = JSON.parse(JSON.stringify(Form));
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
