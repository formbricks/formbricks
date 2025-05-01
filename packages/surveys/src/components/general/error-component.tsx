import { TResponseErrorCodesEnum } from "@/types/response-error-codes";

interface ErrorComponentProps {
  readonly errorType: TResponseErrorCodesEnum.RecaptchaError | TResponseErrorCodesEnum.InvalidDeviceError;
}

export function ErrorComponent({ errorType }: ErrorComponentProps) {
  const errorData = {
    [TResponseErrorCodesEnum.RecaptchaError]: {
      title: "We couldn't verify that you're human.",
      message:
        "Your response could not be submitted because it was flagged as automated activity. If you breathe, please try again.",
    },
    [TResponseErrorCodesEnum.InvalidDeviceError]: {
      title: "This device doesn’t support spam protection.",
      message: "Please disable spam protection in the survey settings to continue using this device.",
    },
  };

  const error = errorData[errorType];

  return (
    <div
      className="fb-flex fb-flex-col fb-bg-white fb-p-8 fb-text-center fb-items-center"
      role="alert"
      aria-live="assertive">
      <span className="fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900">
        {error.title}
      </span>
      <p className="fb-max-w-lg fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">{error.message}</p>
    </div>
  );
}
