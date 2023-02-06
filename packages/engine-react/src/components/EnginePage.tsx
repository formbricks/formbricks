import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormPage } from "../types";

interface FormProps {
  page: FormPage;
  onSkip: () => void;
  onPageSubmit: (submission: any) => void;
  onFinished: ({ submission }: any) => void;
  submission: any;
  setSubmission: (v: any) => void;
  finished: boolean;
  formbricksUrl: string;
  formId: string;
  schema: any;
}

export function EnginePage({
  page,
  onSkip,
  onPageSubmit,
  onFinished,
  submission,
  setSubmission,
  formbricksUrl,
  formId,
  schema,
}: FormProps) {
  const [submissionId, setSubmissionId] = useState<string>();
  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: {},
  } = useForm();
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
      onFinished({ submission });
    }
  }, [page, formId, formbricksUrl, submissionId]);

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
      onPageSubmit({ submission: updatedSubmission, page, pageSubmission: data });
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
      {page.elements.map((element) => {
        const ElementComponent = element.component;
        return (
          <div key={element.id}>
            {element.name ? (
              <ElementComponent
                element={element}
                control={control}
                register={register}
                onSubmit={() => handleSubmitElement()}
                disabled={submittingPage}
                allowSkip={page.config?.allowSkip}
                skipAction={onSkip}
                autoSubmit={page.config?.autoSubmit}
                loading={submittingPage}
              />
            ) : (
              <ElementComponent element={element} />
            )}
          </div>
        );
      })}
    </form>
  );
}
