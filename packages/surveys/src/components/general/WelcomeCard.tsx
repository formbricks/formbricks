import SubmitButton from "../buttons/SubmitButton";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";

interface WelcomeCardProps {
  headline?: string;
  html?: string;
  fileUrl?: string;
  buttonLabel?: string;
  timeToFinish?: boolean;
  onSubmit: (data: { [x: string]: any }) => void;
  brandColor: string;
}

export default function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  timeToFinish,
  onSubmit,
  brandColor,
}: WelcomeCardProps) {
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
            focus={true}
            onClick={() => {
              onSubmit({ ["welcomeCard"]: "clicked" });
            }}
            type="button"
            brandColor={brandColor}
          />
          <div className="flex items-center text-xs text-[--fb-subheading-color]">Press Enter ↵</div>
        </div>
      </div>
      {timeToFinish && <></>}
    </div>
  );
}
