import clsx from "clsx";
import { usePlausible } from "next-plausible";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Button from "../shared/Button";
import { SurveyPage } from "./engineTypes";

interface SurveyProps {
  page: SurveyPage;
  onSkip: () => void;
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
  onSkip,
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
  const plausible = usePlausible();
  const [submittingPage, setSubmittingPage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    reset();
  }, [page, reset]);

  useEffect(() => {
    if (page.endScreen) {
      fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finished: true }),
      });
      plausible("waitlistFinished");
    }
  }, [page, formId, formbricksUrl, submissionId, plausible]);

  const sendToFormbricks = async (partialSubmission: any) => {
    const submissionBody: any = { data: partialSubmission };
    if (page.config?.addFieldsToCustomer && Array.isArray(page.config?.addFieldsToCustomer)) {
      for (const field of page.config?.addFieldsToCustomer) {
        if (field in partialSubmission) {
          if (!("customer" in submissionBody)) {
            submissionBody.customer = {};
          }
          submissionBody.customer[field] = partialSubmission[field];
        }
      }
    }
    if (!submissionId) {
      const res = await Promise.all([
        fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submissionBody),
        }),
        fetch(`${formbricksUrl}/api/capture/forms/${formId}/schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schema),
        }),
      ]);
      if (!res[0].ok || !res[1].ok) {
        alert("There was an error sending this form. Please contact us at hola@formbricks.com");
        return;
      }
      const submission = await res[0].json();
      setSubmissionId(submission.id);
    } else {
      const res = await fetch(`${formbricksUrl}/api/capture/forms/${formId}/submissions/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionBody),
      });
      if (!res.ok) {
        alert("There was an error sending this form. Please contact us at hola@formbricks.com");
        return;
      }
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
      plausible(`waitlistSubmitPage-${page.id}`);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      alert("There was an error sending this form. Please contact us at hola@formbricks.com");
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
            <div
              key={element.id}
              className={clsx(submittingPage && "animate-[pulse_0.8s_ease-out_infinite]")}>
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
      {!finished && (
        <div className="mx-auto mt-8 flex w-full max-w-xl justify-end">
          {page.config?.allowSkip && (
            <Button
              variant="secondary"
              type="button"
              className="transition-all ease-in-out hover:scale-105"
              onClick={() => onSkip()}>
              Skip
            </Button>
          )}
          {!(page.config?.autoSubmit && page.elements.length == 1) && (
            <Button
              variant="primary"
              type="submit"
              className="ml-2 transition-all ease-in-out hover:scale-105">
              Next
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
