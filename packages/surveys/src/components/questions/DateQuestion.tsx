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
      // script.src =
      //   "https://question-date-test.s3.ap-south-1.amazonaws.com/question-date.umd.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEF4aCmFwLXNvdXRoLTEiRzBFAiEAgp1zS0BG6iQUF2b5C%2BfGEO6lYHNdhDO%2FcyPhwqd%2F5doCIESalfrJKnDKAd6aeKLvNM6IYJZSBclyWkDL6%2FB8ahOaKu0CCLf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMNTc2Nzc1NDM4NjI1IgwfzJ8JtYKlIkQprEwqwQL%2BFPKMuVI3HITg2GCSIg%2BDo8bAPWJrJpV7pYd4GPBdjVmu7Bjh9CVSB4NcRd88S25hvDCQNPX2cluGEeSGbiT7J4gETlsS1fDsLZapm265KeA8HYphW0kdG99BwSIfPLEb5QUGYASqimyK%2FOoXeAHel2hRxudB%2FFCbC7EgnmUXMaRBrcmfodlQ7RPGq7Wrbxtdx0NNA%2BjxRvwnFpxJwH9pEoeplZNRA9t1Jo72V1c6Mc7WyYtMIkSBQgQey7nHo6vtiACM6LWA%2B%2FP03RHBiKlAqICZFjAYaYG%2BpBnaYmm2AIukGV2CTppWeihVHHDgPjcwFay5BlQ4aUPoAXvogbcSzOQKhoj%2F7cAJt0hKWI95TNoYRRIFCf3r1rEKO9ZQJGdDl61x3wh0bI8tdHqnyNpE8DoyrX%2BotgC8L5KoG42nShwwiP2VqwY6swIpsSSRpuyUDFUuiXlecpvE650CvDfIesHmOMHFhd2cLK0avYnzg4GBv6XpYNo6GYGQIH5%2FFoffaX3qCPd0pFsUTHFIoQ9NVa12cGVRRfrpARnQnh1dmboTFcOU3V7us%2FXw2EXbk74aINdz5BElD42gi6JJ5sapicKTuvaBA5lgbh9pHM%2FOHlYs%2F2lPVPl7j%2BkaVLZptMVp9XsTWPigDqNlj8U86ufcRSc09C7GUMNJP%2BUbPMQuUIfrJVxmkp8N%2BW%2Fy6Rbxr%2B2nrH1%2FGCJbuKm4akWsxZI9RPZlyiu%2BsDJF0CqeG%2FIa9KHZ5iODdDoFC54WX1fPCKvdzAPqMFSWBYCHyL9nXzOigEkDWF5YjuHjM6%2BFo0XE%2BOWe77F%2FdWHcbECYDg8O66uEkosp6smWo%2F45nR7w&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231128T054638Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQZZXF5Q7E%2F20231128%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=9b0a33cfbdeaaa83e1e7ffeec3516035846768b817f72119c878274660ae7f5d";
      script.src = "http://localhost:3003/question-date.umd.js";
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePickerOpen, question.format]);

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;
      onChange({ [question.id]: date.toDateString() });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
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
