import type { ActiveAIProvider } from "./types";

export interface AIConfigurationErrorDetails {
  provider?: ActiveAIProvider | null;
  model?: string | null;
  missingFields?: string[];
  invalidFields?: string[];
}

export class AIConfigurationError extends Error {
  code: "providerMissing" | "invalidProvider" | "providerNotConfigured";
  details: AIConfigurationErrorDetails;

  constructor(
    code: "providerMissing" | "invalidProvider" | "providerNotConfigured",
    message: string,
    details: AIConfigurationErrorDetails = {}
  ) {
    super(message);
    this.name = "AIConfigurationError";
    this.code = code;
    this.details = details;
  }
}
