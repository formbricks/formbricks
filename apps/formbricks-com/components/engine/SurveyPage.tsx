import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Button from "../shared/Button";
import { SurveyPage } from "./engineTypes";

interface SurveyProps {
  page: SurveyPage;
  onSubmit: (submission: any) => void;
  submission: any;
  setSubmission: (v: any) => void;
  finished: boolean;
  formbricksUrl: string;
  formId: string;
  schema: any;
}

export function SurveyPage({
  page,
  onSubmit,
  submission,
  setSubmission,
  finished,
  formbricksUrl,
  formId,
  schema,
}: SurveyProps) {
  const [submissionId, setSubmissionId] = useState<string>();
  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: { errors },
  } = useForm();
  const [submittingPage, setSubmittingPage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    reset();
  }, [page, reset]);

  const sendToFormbricks = async (partialSubmission: any) => {
    if (!submissionId) {
      const res = await Promise.all([
        await fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: partialSubmission }),
        }),
        await fetch(`${formbricksUrl}/api/capture/forms/${formId}/schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schema),
        }),
      ]);
      const submission = await res[0].json();
      setSubmissionId(submission.id);
    } else {
      await fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: partialSubmission }),
      });
    }
  };

  const submitPage = async (data: any) => {
    setSubmittingPage(true);
    const updatedSubmission = { ...submission, ...data };
    setSubmission(updatedSubmission);
    try {
      await sendToFormbricks(data);
      setSubmittingPage(false);
      onSubmit(updatedSubmission);
    } catch (e) {
      alert("There was an error sending this form. Please try again later.");
    }
  };

  const handleSubmitElement = () => {
    if (page.config?.autoSubmit && page.elements.length == 1) {
      formRef.current?.requestSubmit();
      setSubmittingPage(true);
    }
  };

  return (
    <form onSubmit={handleSubmit(submitPage)} ref={formRef}>
      <div className="grid grid-cols-1 gap-8">
        {page.elements.map((element) => {
          const ElementComponent = element.component;
          return (
            <div key={element.id} className={clsx(submittingPage && "animate-pulse")}>
              {element.name ? (
                <ElementComponent
                  element={element}
                  control={control}
                  register={register}
                  onSubmit={() => handleSubmitElement()}
                  disabled={submittingPage}
                />
              ) : (
                <ElementComponent element={element} />
              )}
            </div>
          );
        })}
      </div>
      {!finished && !(page.config?.autoSubmit && page.elements.length == 1) && (
        <div className="mx-auto mt-8 flex w-full max-w-xl justify-end">
          <Button
            variant="primary"
            type="submit"
            onClick={() => window.scrollTo(0, 0)}
            className="transition-all ease-in-out hover:scale-105">
            Next
          </Button>
        </div>
      )}
    </form>
  );
}
