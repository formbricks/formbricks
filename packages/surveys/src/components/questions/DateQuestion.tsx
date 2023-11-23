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
        "https://question-date-test.s3.ap-south-1.amazonaws.com/question-date.umd.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEOf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiRjBEAiB96rIepeEya6cXBsPHo%2F%2FWMBO2wDf7QDqUJPtPfVRY8QIgY58pyC6PjGoXnNUUsGGyuzuWD1DNEKRp7QGQqfOZr5sq5AIIQBAAGgw1NzY3NzU0Mzg2MjUiDCW7aZgdCqiRuPD1DyrBAm3l59NJTSoxwGdJJ%2FSN50df0JuHfZT8deIa7GTzkPLldiPAFmihe62IGlP71WvQV7pIVnGbybkQ3pW1YotIcfSzcJvp%2BoNb1QVuNBf38irBfv0Bk5%2B2CzzNnYTKninRqRJI3LPS17CbJbPFQZNHY8BIp9GjRtd2Xe8AUIuh5IR8E74%2BQp0UY6myNbl2wnOHe3k%2B0RI6A9M%2BjOoif%2Bt7ESy8xmbR8pK3jwuLBhZnnz2Wjw%2F3fZQGbkaYtMHvm%2FRIA6bZzxZ6zx21nbuFoySTKjtBB%2B61PjZwDDIHFsP9g5y7AU0XLooeTpsnxnWdAD5FeEMerqLYdo3CXjUufhx74WrCMckY6CfPAerTzqHMJpjjOdoHpSWisjyX5ogzSXoPsYoeMNTpwoGa2NQ4oUUQjVnkQc%2F0UIW7wAM4mdqOOWDuRzCN7vuqBjq0AlY5ZnA%2Fk%2F1LYpjYjnGT4a%2FJ1eyBHUKfZcrsV%2BW3VUVszBobJRj0vKY1XqItE1jlmhQjBAs9u8fixPXcQrpfcxTUn39MuI5xILocLDULIc1MB4Mc6g5MLu0Wx%2BmtYI3Yn3EriaQPblZb16kHCtvZ481uAR%2BBxnj8JAqzT8Dp2%2BeTQix09PqGNNN9UPjgW%2BRtE9ACOtY%2FAOsWu6x6Tp6o1%2FDKY4cP8fJ9raETy0G9E%2Fq%2FltuLHusjBbC8HxB72avj8TIR1xRofG732AAfFjZr0wzhEweUpuI5MkWCL7%2FycL%2BLK8wBxZBOl0JmxOMrw0KElz9dGqepmzZvrj0Uoswbp6mRhBMGBa9cI2CmCZSn8L%2FScCxYssHKDLSR4qPrZXQvtXq%2BDSiZvMLFsQWOiRhJ0mrvdA%2BH&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231123T065503Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQXASMN4VN%2F20231123%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=2031ef04880775bf989cd04c9f5bb0675d0fda695aded51f5373e1702973b175";
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
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <SubmitButton isLastQuestion={isLastQuestion} onClick={() => {}} buttonLabel="Submit" />
      </div>
    </form>
  );
}
