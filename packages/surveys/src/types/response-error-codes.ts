export enum TResponseErrorCodesEnum {
  ResponseSendingError = "ResponseSendingError",
  RecaptchaError = "RecaptchaError",
  InvalidDeviceError = "InvalidDeviceError",
  ResponseAlreadyCompleted = "ResponseAlreadyCompleted",
  // Permanent 4xx rejection (not "already completed"): the item is dropped from the queue,
  // so this is non-retryable — distinct from the retryable ResponseSendingError.
  ResponseSendingErrorPermanent = "ResponseSendingErrorPermanent",
}
