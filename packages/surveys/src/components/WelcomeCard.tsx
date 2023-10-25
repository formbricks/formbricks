import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import { TimerIcon } from "lucide-react";
import { calculateElementIdx } from "../lib/utils";
import { TSurveyWithTriggers } from "@formbricks/types/js";

interface WelcomeCardProps {
  headline?: string;
  html?: string;
  fileUrl?: string;
  buttonLabel?: string;
  timeToFinish?: boolean;
  brandColor: string;
  onSubmit: (data: { [x: string]: any }) => void;
  survey: TSurveyWithTriggers;
}

export default function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  timeToFinish,
  brandColor,
  onSubmit,
  survey,
}: WelcomeCardProps) {
  const calculateTimeToComplete = () => {
    let idx = calculateElementIdx(survey, 0);
    if (idx === 0.5) {
      idx = 1;
    }
    const timeInSeconds = (survey.questions.length / idx) * 15; // Assuming base unit is 15 seconds per question.

    if (timeInSeconds > 360) {
      // 360 seconds is 6 minutes
      return "6+ minutes";
    } else if (timeInSeconds > 60) {
      const minutes = Math.floor(timeInSeconds / 60);
      const seconds = Math.round(timeInSeconds % 60);

      if (seconds === 0) {
        return `${minutes} minutes`;
      }

      return `${minutes} minutes ${seconds} seconds`;
    }

    return `${Math.round(timeInSeconds)} seconds`;
  };

  return (
    <div>
      {fileUrl && (
        <img src={fileUrl} className="mb-8 max-h-96 w-1/3 rounded-lg object-contain" alt="Company Logo" />
      )}

      <Headline headline={headline} questionId="welcomeCard" />
      <HtmlBody htmlString={html} questionId="welcomeCard" />

      <div className="mt-10 flex w-full justify-between">
        <div className="flex w-full justify-start gap-4">
          <SubmitButton
            buttonLabel={buttonLabel}
            isLastQuestion={false}
            brandColor={brandColor}
            focus={true}
            onClick={() => {
              onSubmit({ ["welcomeCard"]: "clicked" });
            }}
            type="button"
          />
          <div className="flex items-center text-xs text-slate-600">Press Enter ↵</div>
        </div>
      </div>
      {timeToFinish && (
        <div className="item-center mt-4 flex text-slate-500">
          <TimerIcon className="mr-2 h-4 w-4" />
          <p className="text-xs">Takes {calculateTimeToComplete()}</p>
        </div>
      )}
    </div>
  );
}
