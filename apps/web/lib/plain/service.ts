import { TPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { PlainClient } from "@team-plain/typescript-sdk";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TIntegrationPlainConfig, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";

/**
 * Function that handles sending survey response data to Plain
 */
export const writeData = async (
  config: TIntegrationPlainConfig,
  data: TPipelineInput,
  integrationConfig: TIntegrationPlainConfigData
): Promise<Result<void, Error>> => {
  try {
    // Decrypt the API key
    const decryptedToken = symmetricDecrypt(config.key, ENCRYPTION_KEY!);
    const client = new PlainClient({
      apiKey: decryptedToken,
    });

    const titleId = integrationConfig.mapping.find((m) => m.plainField.id === "threadTitle")?.question.id;

    const componentTextId = integrationConfig.mapping.find((m) => m.plainField.id === "componentText")
      ?.question.id;

    const labelId = integrationConfig.mapping.find((m) => m.plainField.id === "labelTypeId")?.question.id;

    const title = titleId ? String(data.response.data[titleId]) : null;
    if (!title) return err(new Error("Missing title in response data."));

    const componentText = componentTextId ? String(data.response.data[componentTextId]) : null;
    if (!componentText) return err(new Error("Missing component text in response data."));

    console.log(labelId);

    // Extract contact information from the response data
    let firstName = "";
    let lastName = "";
    let email = "";

    // Find contact info questions by detecting arrays with email pattern
    Object.entries(data.response.data || {}).forEach(([_, answer]) => {
      if (
        Array.isArray(answer) &&
        answer.length >= 3 &&
        typeof answer[2] === "string" &&
        answer[2].includes("@")
      ) {
        firstName = String(answer[0] || "");
        lastName = String(answer[1] || "");
        email = String(answer[2] || "");
      }
    });

    // Create a customer on Plain
    await client.upsertCustomer({
      identifier: {
        emailAddress: email,
      },
      // If the customer is not found and should be created then
      // these details will be used:
      onCreate: {
        fullName: `${firstName} ${lastName}`,
        email: {
          email: email,
          isVerified: false, // or true, depending on your requirements
        },
      },
      // If the customer already exists and should be updated then
      // these details will be used. You can do partial updates by
      // just providing some of the fields below.
      onUpdate: {
        fullName: {
          value: `${firstName} ${lastName}`,
        },
      },
    });

    // Create a thread on Plain
    const thread = await client.createThread({
      title: title,
      customerIdentifier: {
        emailAddress: email,
      },
      components: [
        {
          componentText: {
            text: componentText!,
          },
        },
      ],
      ...(labelId ? { labelTypeIds: [labelId] } : {}),
    });
    console.log(thread);
    return ok(undefined);
  } catch (error) {
    logger.error("Exception in Plain writeData function", { error });
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};
