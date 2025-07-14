import { TPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { processResponseData } from "@/lib/responses";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { PlainClient } from "@team-plain/typescript-sdk";
import { logger } from "@formbricks/logger";
import { TIntegrationPlainConfig, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { TResponseMeta } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const writeData = async (
  databaseId: string,
  properties: Record<string, Object>,
  config: TIntegrationPlainConfig
) => {
  const decryptedToken = symmetricDecrypt(config.key, ENCRYPTION_KEY!);
  const client = new PlainClient({ apiKey: decryptedToken });
  const res = await client.createThread({
    title: "Bug Report",
    customerIdentifier: {
      emailAddress: "jane@acme.com",
    },
    components: [
      {
        componentText: {
          text: "The login button is not working, it doesn't do anything.",
        },
      },
    ],
  });

  if (res.error) {
    console.error(res.error);
  } else {
    // The full thread is returned as res.data
    console.log(`Thread created with id=${res.data.id}`);
  }
};
