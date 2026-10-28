import { creativeDocumentAdapter } from "@/app/api/v3/creatives/lib/document-adapter";
import { surveyDocumentAdapter } from "@/app/api/v3/surveys/document/adapter";
import { workflowDocumentAdapter } from "@/app/api/v3/workflows/lib/document-adapter";
import type { TV3DocumentAdapter, TV3DocumentKind } from "./envelope";

const ADAPTERS: Record<TV3DocumentKind, TV3DocumentAdapter> = {
  survey: surveyDocumentAdapter,
  creative: creativeDocumentAdapter,
  workflow: workflowDocumentAdapter,
};

export const getDocumentAdapter = (kind: TV3DocumentKind): TV3DocumentAdapter => ADAPTERS[kind];
