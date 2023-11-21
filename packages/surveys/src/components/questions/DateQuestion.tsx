import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";

interface IDateQuestionProps {
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
}: IDateQuestionProps) {
  const [datePickerOpen, _setDatePickerOpen] = useState(true);
  const defaultDate = value ? new Date(value as string) : undefined;

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    // @ts-expect-error
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://question-date-test.s3.ap-south-1.amazonaws.com/index.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELz%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiSDBGAiEAtdkLfsVtP881rd1aN9NqQAM9o9Oeip6sNv3%2FV%2B7W%2BIsCIQD0rujJn%2FZfT6iVlTbn5CCfCNAvdk0YGlL3V8KxuRQ54irkAggVEAAaDDU3Njc3NTQzODYyNSIMw0yc9Le66hUZK6pJKsECyT%2BbSPlbnLOHyyvw6icataAxM%2FGhibSzifh4i96gamYororznLupAyQSHbj8JFSkF4BTRQ9Y7WAxGdXVcsH1NS5JgvmsRa03t%2FTzH94SdXjltHQK0WorNMfF3LoEc58EubzFV%2BHcy5TBg061n7%2F7tLiHJz9bIDnfEz7Sax%2BhVwbexA3DxQKu7fdNDE66vQRgy9zXbseZMEvMN5BD1H844ocgdPiDtEd2hZOcd%2BvgDRCTFY6Seyue1WMgZMCy2P3olhT%2Bn2l9dDyJ6LbeAmAekLPTQcJWj7yzr4CHlTRzdMqkafK6D9FwZqQiRipDmCE4zRxgslTTsC794YeKOPx0Gx3%2BZaHrJNzMh8qchuoZp0MZxp8OGyPnyLWwJYX6Qre%2BaaM4zurfY8cX9QHbGmrurFOVSHodHLwVOW4NF9BSMl%2BSMLa28qoGOrIC7OuKTnG7Ibf%2Fw3YA0q8lGVArJbc6RJzHBE8LVUOhFr%2BesHrZG89s6Rwhzli6oc9vEzKKSsEgJ%2FLFJXxbWwsN6wvZDXlKQA1vNri314mfoXhEwtAZdLvT%2BBVr%2F6%2BUXxdwxNeQ4RrgORbQ2MRVFkgbs6HhVVyTOg1TYcxe5EhFOZn7HKhIWKfgZ7C810JawD4tk3ZE59Jk5D50T19ETuUrhn6J%2F2e1N71rJ1MqjuumvaeV1PglgtBPIbu1kDlXM8XsVGYjtCN0Xp%2F7SdGHz6fFt5inW0NuArlKJ5rvrTXu1%2BlBE4gvQD5k9wNy%2FQytEMIRr9GP0d8LOQx%2FCiuOxfcQshFRnOEPctOUmRYUy4RE85uu6kxPGPRTrBGJsN9GEMCcDHTMuEzj01nDhUdoBHm%2BSVAo&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231121T115950Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQZYEB5DO2%2F20231121%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=24ae18adf42960e788924bfdd8b5ad8f64b504b62d6fbbf3b25cd45ddcddc227";
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

      <div className="mt-4" id="date-picker-root"></div>

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
