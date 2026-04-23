import { createVertex as createGoogleCloudProvider } from "@ai-sdk/google-vertex";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

type GoogleProviderSettings = NonNullable<Parameters<typeof createGoogleCloudProvider>[0]>;

const parseGoogleCredentialsJson = (value?: string | null): Record<string, unknown> | undefined => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return JSON.parse(normalizedValue) as Record<string, unknown>;
};

export const googleProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    if (!normalizeValue(environment.AI_GOOGLE_CLOUD_PROJECT)) {
      missingFields.push("AI_GOOGLE_CLOUD_PROJECT");
    }

    if (!normalizeValue(environment.AI_GOOGLE_CLOUD_LOCATION)) {
      missingFields.push("AI_GOOGLE_CLOUD_LOCATION");
    }

    const credentialsJson = normalizeValue(environment.AI_GOOGLE_CLOUD_CREDENTIALS_JSON);
    const applicationCredentials = normalizeValue(environment.AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS);

    if (!credentialsJson && !applicationCredentials) {
      missingFields.push("AI_GOOGLE_CLOUD_CREDENTIALS_JSON or AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS");
    }

    if (credentialsJson) {
      try {
        parseGoogleCredentialsJson(credentialsJson);
      } catch {
        invalidFields.push("AI_GOOGLE_CLOUD_CREDENTIALS_JSON");
      }
    }

    return {
      missingFields,
      invalidFields,
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "google",
      model,
      project: normalizeValue(environment.AI_GOOGLE_CLOUD_PROJECT),
      location: normalizeValue(environment.AI_GOOGLE_CLOUD_LOCATION),
      hasCredentialsJson: Boolean(normalizeValue(environment.AI_GOOGLE_CLOUD_CREDENTIALS_JSON)),
      hasApplicationCredentials: Boolean(normalizeValue(environment.AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS)),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const project = normalizeValue(environment.AI_GOOGLE_CLOUD_PROJECT);
    const location = normalizeValue(environment.AI_GOOGLE_CLOUD_LOCATION);
    const credentialsJson = normalizeValue(environment.AI_GOOGLE_CLOUD_CREDENTIALS_JSON);
    const applicationCredentials = normalizeValue(environment.AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS);

    if (!project || !location || (!credentialsJson && !applicationCredentials)) {
      throw new AIConfigurationError("providerNotConfigured", "Google Cloud AI credentials are incomplete", {
        provider: "google",
        missingFields: [
          ...(!project ? ["AI_GOOGLE_CLOUD_PROJECT"] : []),
          ...(!location ? ["AI_GOOGLE_CLOUD_LOCATION"] : []),
          ...(!credentialsJson && !applicationCredentials
            ? ["AI_GOOGLE_CLOUD_CREDENTIALS_JSON or AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS"]
            : []),
        ],
      });
    }

    let googleAuthOptions: GoogleProviderSettings["googleAuthOptions"] | undefined;

    if (credentialsJson) {
      try {
        googleAuthOptions = {
          credentials: parseGoogleCredentialsJson(credentialsJson),
        } as GoogleProviderSettings["googleAuthOptions"];
      } catch {
        throw new AIConfigurationError(
          "providerNotConfigured",
          "AI_GOOGLE_CLOUD_CREDENTIALS_JSON must be valid JSON",
          {
            provider: "google",
            invalidFields: ["AI_GOOGLE_CLOUD_CREDENTIALS_JSON"],
          }
        );
      }
    } else if (applicationCredentials) {
      googleAuthOptions = {
        keyFilename: applicationCredentials,
      } as GoogleProviderSettings["googleAuthOptions"];
    }

    const googleCloudProvider = createGoogleCloudProvider({
      project,
      location,
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });

    return googleCloudProvider(model);
  },
};
