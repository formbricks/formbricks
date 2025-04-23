import { createAzure } from "@ai-sdk/azure";
import {
  AI_AZURE_EMBEDDINGS_API_KEY,
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID,
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME,
  AI_AZURE_LLM_API_KEY,
  AI_AZURE_LLM_DEPLOYMENT_ID,
  AI_AZURE_LLM_RESSOURCE_NAME,
} from "./constants";

export const llmModel = createAzure({
  resourceName: AI_AZURE_LLM_RESSOURCE_NAME, // Azure resource name
  apiKey: AI_AZURE_LLM_API_KEY, // Azure API key
})(AI_AZURE_LLM_DEPLOYMENT_ID || "llm");

export const embeddingsModel = createAzure({
  resourceName: AI_AZURE_EMBEDDINGS_RESSOURCE_NAME, // Azure resource name
  apiKey: AI_AZURE_EMBEDDINGS_API_KEY, // Azure API key
}).embedding(AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID || "embeddings", {
  dimensions: 512,
});
