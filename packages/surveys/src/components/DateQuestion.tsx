import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";
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
  const [datePickerOpen, _setDatePickerOpen] = useState(true);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    // @ts-expect-error
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://super-test-bucket-pandeyman.s3.ap-south-1.amazonaws.com/index.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaCmFwLXNvdXRoLTEiRjBEAiAprVecwLELJZGi7RE54mHmdFSqU9N3p6VFxbFVDN%2FZjgIgSNSJCOX3yczVNK8gcTFNJlgwADjwT5JFzp%2FS0oLJpjMq7QIIif%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgw1NzY3NzU0Mzg2MjUiDG2nuzV%2FVTcAeCx4lirBAoxxP%2F1g5v0blU7ZBDXY25hoSs9migI9e7aMxRuemvM6C5%2BbMPwjrpKtmyT4bgu5hgsINF7YH2HLfdxMyE42T3%2FrUb%2Bh%2Bl033YYuBw6AKQMId3Y0PzGZ2TtqLrcq1q2jYBSUIcDrP9v7PT4F3dztbuWnaDFlHIJrljo7238DrsBlKxnKEF7Lb0GR%2F3XSIUVbvPevbrQxToH60UR4FStyc%2B9fomqw2ru3SWodzvNzR6hrbWWOVDw3HpoIuyyOqpd0mW26ggX7aUGNuuAxi2SxQo4iQ8OzBldxrwcIFrf0iDffPmL%2FcweGewNz%2BjNkPbc9425qqKntlm6s86PDF9DfpVbw%2F6e9ShkyEytujXuZNF%2BvRG325wIPPko9Kjg%2F3SW3wavSIhK68w8uRKOB0hr4dA%2Fx8D4S%2F%2BBVECkbCsi5qNNftzDuuaKqBjq0AgCjPJk2KNCYeDkt9NTBCUlA%2FMIOBuoTp9d3V79bGPLVZbazkFqDagYZdG%2FA8MfDfm%2B2lhIXX00HAL0Gn0n0q2cm2w8%2B4T%2BuORLPEZdJL49IvE97KlnGZnXSfZreY%2F4i8G0Y%2Bi1U2MKlNz%2FCHkekmZe%2BDnV7EyRWtewQfUumHjAw2zNXfCfFD7yS5gdP1zaj1%2FUq4X3PT2S1lLw4kdnZJTFYiQFayQym3mU%2F%2FYN0XndnP7OPlg3eToawPJSRqYDOhwkrcIWaf%2FoM%2Fm%2BooTHqaNHId5qMIBa%2Btaw%2FbhG0rxCuW8uQhhVLk%2FfXaGO0AF7xiHuBMXhIflabtWHQZ9b%2B6qrJcqUCFPMZZXmeYcYzc4aJiydogbaLpl2LeZkVt2l6%2Fzpa0zoEW%2BV9Q9Vf%2FWuy06RU%2FqFT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231106T083859Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQ4GIY32YI%2F20231106%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=0f9cc50e677296ae8fc5b11ba76fb04b35d6a9206ce4e48167521fd0c507c74d";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-expect-error
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

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;
      setDate(date);
    });
  }, []);

  // sync the date with the date picker
  useEffect(() => {
    // @ts-expect-error
    window.selectedDate = date;
  }, [date]);

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

      <h1 className="my-4">
        {/* @ts-ignore */}
        You Selected: {date?.toLocaleDateString()}
      </h1>

      <div className="mt-4" id="date-pick"></div>

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
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
          buttonLabel="Submit"
        />
      </div>
    </form>
  );
}
