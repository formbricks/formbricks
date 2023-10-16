"use client";

import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { useEffect, useState } from "preact/hooks";

interface IDateQuestionProps {
  question: TSurveyDateQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
  autoFocus?: boolean;
}

export default function DateQuestion({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: IDateQuestionProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    // @ts-ignore
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://super-test-bucket-pandeyman.s3.ap-south-1.amazonaws.com/index.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFkaCmFwLXNvdXRoLTEiRjBEAiBajz3ePckvLRX1jvia4ylpaUL1xyKNrR0nkpaXfYjyrAIgWc7nNLrlqcYh7FKOk03i%2BGzKc5XHqze5ZuwUlPxAMh4q5AIIcxAAGgw1NzY3NzU0Mzg2MjUiDN1zCp2k6aL%2FLY3vgCrBAuXEKwhossybO0CvexhKh7dmexU4qd5kKyB03szKTC%2FpGBev8oB%2BtO4peawZQ%2Fn%2F0LL%2BUsEVx7oV4bDaR4FUKUDWdTlF%2FvnIkDXQGsfZmlKNmmBwmfg%2FCZTaHEK9oz4vpJGFVW%2BG3hsXgAomQG9Rf4HUQITj9CkZ1FGQ%2BhPa9wEVTzvkIlN%2BqChsiAWrki3RsYB2PP2Itc%2FKWQV05zMlaDLJwyC6LNBm5%2BnWjokMFZoVXvtpGut687mOFRzNsYe64ni11T%2BmswGPRzsopxVpeMp82jByi%2F5VfK6xcdQdetAyCrxGBLK24VsrJANMgCw9brpO4r4VpXgVKRQ4n2%2Fp306FwWbKWfWGOxKW4A1poVAnagCKR%2BU1kpXSbIGpA043Vqk3zhU1XRza43gmnJUy%2BsL7kxPFZj%2Bn5Dw2ya08Z6y1czD6grSpBjq0ApKI8hkrOC%2FZ%2B8uDHOfBfRRG0CchS%2BG9JkjUJcJYEfN7HoNONzRNsyDFjiV58DuoKEe63hfqaJq%2BroyDr%2B03AsUsUBZlGn9qodtTIlULzjxHs4PazZ0mfUCCFAKMEuN2Ji9eMf9s2%2BOAZebz%2BL2oEZ8NPcidcFzZI0ISJ8W8aliJejyMYQ84B9X5E2O1wcTaBcvBLLmJ4YTNT6mx3ROQHegeMF0w89BEWsOerrVL%2B8WHZx%2BpP4doCgFFLqFn3OYZLs3U%2Fc7sVsD2iraL4vWM2CF1yKAVfILI8M48UWYheF5DzhMHfbONO8D2HPO%2FUMRjYpFSToaAwKpu2YZ1kT%2BsinUUWK2aAPEaKBOhPCgTjibs0NVh1zlVOvbYcrTd44fyRBRjWydg2cQISHuvuFZrb2yJnddT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231016T094723Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43199&X-Amz-Credential=ASIAYMST6YEQWIC4TL5S%2F20231016%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=376b756b8da39f6c83d2515099de16e98c16e709fe219bc5026924c2ea92bae5";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-ignore
        window.initDatePicker(document.getElementById("date-pick"));
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, just initialize
      // @ts-ignore
      window.initDatePicker(document.getElementById("date-pick"));
    }

    return () => {};
  }, [datePickerOpen]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        onSubmit({ [question.id]: value });
        // }
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <div className="mt-4" id="date-pick">
        {/* From here, the date picker should be opened? */}

        <button
          className="px-3 py-1 rounded-sm bg-slate-800"
          type="button"
          onClick={() => {
            setDatePickerOpen(true);
          }}>
          <span className="text-white">Open date picker</span>
        </button>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          question={question}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
