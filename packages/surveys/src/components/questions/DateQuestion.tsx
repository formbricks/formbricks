import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";

interface DateQuestionProps {
  question: TSurveyDateQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
}

export default function DateQuestion({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  onChange,
}: DateQuestionProps) {
  const [datePickerOpen, _setDatePickerOpen] = useState(true);
  const defaultDate = value ? new Date(value as string) : undefined;

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://question-date-test.s3.ap-south-1.amazonaws.com/question-date.umd.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEwaCmFwLXNvdXRoLTEiSDBGAiEAl1dJQYvkHIkUoGgr12Sg94EGyp9Kjp7O1dCqkx8PkqkCIQDk8nP3m%2FBQGFHphq%2FYI38%2BXCz6JBZvxK1Folsm0nOb3CrtAgil%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDU3Njc3NTQzODYyNSIMGitdoIbYUIaPGGTxKsECCx%2FYnee6lrJ2RoS9mfNbycLkbHfrt0CEeXQZ4ASKnzRmL6NbMbSE0k7yWmSEM18A0uKG%2Bgsc8u%2Bgvh0uI3vig9rQlTydNIyEMGUWd52WVf4mGXe%2BEH075WsFttAc9cREb%2ByqZSYzJIwPpMGEPwLAhbC50DTkMSZBRITcTPBGY%2B1tjFibpL7TH68t%2BIxNlrZmHHuuSKCOg0u2i06cFyBJOJf0QWn9qEa1E3b1Rku0TOeuSEDxW0EJ9ux6makL5oDYabvz1FGtBvrD8b6aN0fGa50ld5PDjk6Ctm01uOvcm%2BUDGyJTwM4up%2BTNDgtZgSwVcAEPL1nV%2F6NdbGDr4PnZPIHoRmQFhMvEiqdl8qzv5YxcftBD9ZRJAuKHQx5m%2FprCBOacK0zYyQBTHfoOk0LBWA53iLOMQZcX4%2FHrCdBm4UN0MI6KkqsGOrICnVmCVQtPOsgGScMi%2BmLipYJl1uHQaiirCsxpPLlYC%2FWiHzVFWCnuPWxJLePiMPt1%2FdsdqFtlzphJWWjo6QOWfpwa72UbZXzyZGhm4jaY%2B1ZW2NL%2FC8uGKy%2BtXNoNSOkDCJBDS1pzTJKmsmU6iaeFHeYAwpLQWoogg0%2BquAHoDmrPSHIvq%2BzfbQG2sQXECdTrv73IzQRYZ6o1cE9UZuzTmTlsZLr456QetNpsxm6uPe2HyocgnZnRv6WtuO9YZeN1FAU1Ye6sJpJFcrZ2UqHOCCWHDDTzDz7LuSmLO3oqCCal09xOKcm%2BXBQksVm8E2lGzr8TbWNoVM%2BaRmytwMMq82VoPSJxgx00qIirxrGggB%2BsXY5rQMifsgZ1qtMCqrlcB9i8s%2BWnVt0vyLRJt0zcpzC%2B&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231127T120158Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQQPJRWZXB%2F20231127%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=fc3fbbb69df86f7505b01794c332b48517f3779a77f0cd86be1907d1e375fcca";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-expect-error
        window.initDatePicker(document.getElementById("date-picker-root"), defaultDate, question.format);
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, remove the date picker and re-initialize it

      const datePickerContainer = document.getElementById("datePickerContainer");
      if (datePickerContainer) {
        datePickerContainer.remove();
      }

      // @ts-ignore
      window.initDatePicker(document.getElementById("date-picker-root"), defaultDate, question.format);
    }

    return () => {};
  }, [datePickerOpen, question.format]);

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;
      onChange({ [question.id]: date.toDateString() });
    });
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          alert("Please select a date");
          return;
        }
        onSubmit({ [question.id]: value });
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <div className="my-4" id="date-picker-root"></div>

      <div className="mt-4 flex w-full justify-between">
        <div>
          {!isFirstQuestion && (
            <BackButton
              backButtonLabel={question.backButtonLabel}
              onClick={() => {
                onBack();
              }}
            />
          )}
        </div>

        <SubmitButton isLastQuestion={isLastQuestion} onClick={() => {}} buttonLabel={question.buttonLabel} />
      </div>
    </form>
  );
}
