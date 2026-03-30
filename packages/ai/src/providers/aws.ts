import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

export const awsProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];

    if (!normalizeValue(environment.AI_AWS_REGION)) {
      missingFields.push("AI_AWS_REGION");
    }

    if (!normalizeValue(environment.AI_AWS_ACCESS_KEY_ID)) {
      missingFields.push("AI_AWS_ACCESS_KEY_ID");
    }

    if (!normalizeValue(environment.AI_AWS_SECRET_ACCESS_KEY)) {
      missingFields.push("AI_AWS_SECRET_ACCESS_KEY");
    }

    return {
      missingFields,
      invalidFields: [],
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "aws",
      model,
      region: normalizeValue(environment.AI_AWS_REGION),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const region = normalizeValue(environment.AI_AWS_REGION);
    const accessKeyId = normalizeValue(environment.AI_AWS_ACCESS_KEY_ID);
    const secretAccessKey = normalizeValue(environment.AI_AWS_SECRET_ACCESS_KEY);
    const sessionToken = normalizeValue(environment.AI_AWS_SESSION_TOKEN);

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new AIConfigurationError("providerNotConfigured", "AWS Bedrock credentials are incomplete", {
        provider: "aws",
        missingFields: ["AI_AWS_REGION", "AI_AWS_ACCESS_KEY_ID", "AI_AWS_SECRET_ACCESS_KEY"].filter(
          (field) =>
            (field === "AI_AWS_REGION" && !region) ||
            (field === "AI_AWS_ACCESS_KEY_ID" && !accessKeyId) ||
            (field === "AI_AWS_SECRET_ACCESS_KEY" && !secretAccessKey)
        ),
      });
    }

    const bedrock = createAmazonBedrock({
      region,
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    });

    return bedrock(model);
  },
};
