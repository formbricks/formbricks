import { createAzure } from "@ai-sdk/azure";
import { env } from "./env";

const azure = createAzure({
  resourceName: env.AI_AZURE_RESSOURCE_NAME, // Azure resource name
  apiKey: env.AI_AZURE_API_KEY, // Azure API key
});

export const llmModel = azure(env.AI_AZURE_LLM_DEPLOYMENT_ID || "llm");
export const embeddingsModel = azure.embedding(env.AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID || "embeddings", {
  dimensions: 512,
});
