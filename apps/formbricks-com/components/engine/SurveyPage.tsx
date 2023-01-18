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
}

export function SurveyPage({ page, onSubmit, submission, setSubmission, finished }: SurveyProps) {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm();
  const [submittingPage, setSubmittingPage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    reset();
  }, [page, reset]);

  const submitPage = (data: any) => {
    console.log("page submitted:", JSON.stringify(data));
    setSubmittingPage(true);
    const updatedSubmission = { ...submission, ...data };
    setSubmission(updatedSubmission);
    setTimeout(() => {
      setSubmittingPage(false);
      onSubmit(updatedSubmission);
    }, 1000);
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
              {element.field ? (
                <Controller
                  name={element.field!}
                  control={control}
                  rules={{ required: true }}
                  render={({ field }: { field: any }) => (
                    <ElementComponent
                      element={element}
                      field={field}
                      control={control}
                      onSubmit={() => handleSubmitElement()}
                      disabled={submittingPage}
                    />
                  )}
                />
              ) : (
                <ElementComponent element={element} />
              )}
            </div>
          );
        })}
      </div>
      {!finished && !(page.config?.autoSubmit && page.elements.length == 1) && (
        <div className="my-8 flex w-full justify-end">
          <Button variant="primary" type="submit">
            Next
          </Button>
        </div>
      )}
    </form>
  );
}
