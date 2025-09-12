import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { useTranslation } from "react-i18next";

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
