import { useTranslation } from "react-i18next";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";

interface ErrorComponentProps {
  readonly errorType: TResponseErrorCodesEnum.RecaptchaError | TResponseErrorCodesEnum.InvalidDeviceError;
}

export function ErrorComponent({ errorType }: ErrorComponentProps) {
  const { t } = useTranslation();
  const errorData = {
    [TResponseErrorCodesEnum.RecaptchaError]: {
      title: t("errors.recaptcha_error.title"),
      message: t("errors.recaptcha_error.message"),
    },
    [TResponseErrorCodesEnum.InvalidDeviceError]: {
      title: t("errors.invalid_device_error.title"),
      message: t("errors.invalid_device_error.message"),
    },
  };

  const error = errorData[errorType];

  return (
    <div
      className="bg-survey-bg text-heading flex flex-col items-center p-8 text-center"
      role="alert"
      aria-live="assertive">
      <span className="mb-1.5 text-base leading-6 font-bold">{error.title}</span>
      <p className="max-w-lg text-sm leading-6 font-normal">{error.message}</p>
    </div>
  );
}
