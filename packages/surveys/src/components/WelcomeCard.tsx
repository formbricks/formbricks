import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

interface WelcomeCardProps {
  headline?: string;
  html?: string;
  fileUrl?: string;
  buttonLabel?: string;
  timeToFinish?: boolean;
  brandColor: string;
  onSubmit: (data: { [x: string]: any }, isSubmit: boolean) => void;
}

export default function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  timeToFinish,
  brandColor,
  onSubmit,
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
            brandColor={brandColor}
            focus={true}
            onClick={() => {
              onSubmit({ ["welcomeCard"]: "clicked" }, true);
            }}
            type="button"
          />
          <div className="flex items-center text-xs text-slate-600">Press Enter ↵</div>
        </div>
      </div>
      {timeToFinish && <></>}
    </div>
  );
}
