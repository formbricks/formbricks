import { createVertex } from "@ai-sdk/google-vertex";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

type VertexProviderSettings = NonNullable<Parameters<typeof createVertex>[0]>;

const parseVertexCredentialsJson = (value?: string | null): Record<string, unknown> | undefined => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return JSON.parse(normalizedValue) as Record<string, unknown>;
};

export const gcpProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    if (!normalizeValue(environment.AI_GCP_PROJECT)) {
      missingFields.push("AI_GCP_PROJECT");
    }

    if (!normalizeValue(environment.AI_GCP_LOCATION)) {
      missingFields.push("AI_GCP_LOCATION");
    }

    const credentialsJson = normalizeValue(environment.AI_GCP_CREDENTIALS_JSON);
    const applicationCredentials = normalizeValue(environment.AI_GCP_APPLICATION_CREDENTIALS);

    if (!credentialsJson && !applicationCredentials) {
      missingFields.push("AI_GCP_CREDENTIALS_JSON or AI_GCP_APPLICATION_CREDENTIALS");
    }

    if (credentialsJson) {
      try {
        parseVertexCredentialsJson(credentialsJson);
      } catch {
        invalidFields.push("AI_GCP_CREDENTIALS_JSON");
      }
    }

    return {
      missingFields,
      invalidFields,
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "gcp",
      model,
      project: normalizeValue(environment.AI_GCP_PROJECT),
      location: normalizeValue(environment.AI_GCP_LOCATION),
      hasCredentialsJson: Boolean(normalizeValue(environment.AI_GCP_CREDENTIALS_JSON)),
      hasApplicationCredentials: Boolean(normalizeValue(environment.AI_GCP_APPLICATION_CREDENTIALS)),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const project = normalizeValue(environment.AI_GCP_PROJECT);
    const location = normalizeValue(environment.AI_GCP_LOCATION);
    const credentialsJson = normalizeValue(environment.AI_GCP_CREDENTIALS_JSON);
    const applicationCredentials = normalizeValue(environment.AI_GCP_APPLICATION_CREDENTIALS);

    if (!project || !location || (!credentialsJson && !applicationCredentials)) {
      throw new AIConfigurationError("providerNotConfigured", "GCP Vertex AI credentials are incomplete", {
        provider: "gcp",
        missingFields: [
          ...(!project ? ["AI_GCP_PROJECT"] : []),
          ...(!location ? ["AI_GCP_LOCATION"] : []),
          ...(!credentialsJson && !applicationCredentials
            ? ["AI_GCP_CREDENTIALS_JSON or AI_GCP_APPLICATION_CREDENTIALS"]
            : []),
        ],
      });
    }

    let googleAuthOptions: VertexProviderSettings["googleAuthOptions"] | undefined;

    if (credentialsJson) {
      try {
        googleAuthOptions = {
          credentials: parseVertexCredentialsJson(credentialsJson),
        } as VertexProviderSettings["googleAuthOptions"];
      } catch {
        throw new AIConfigurationError(
          "providerNotConfigured",
          "AI_GCP_CREDENTIALS_JSON must be valid JSON",
          {
            provider: "gcp",
            invalidFields: ["AI_GCP_CREDENTIALS_JSON"],
          }
        );
      }
    } else if (applicationCredentials) {
      googleAuthOptions = {
        keyFilename: applicationCredentials,
      } as VertexProviderSettings["googleAuthOptions"];
    }

    const vertex = createVertex({
      project,
      location,
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });

    return vertex(model);
  },
};
