import { CSV_IMPORT_FAILED_ERROR_CODE } from "./types";

type TCsvImportApiSuccess = {
  successes: number;
  failures: number;
  skipped: number;
};

export type TCsvImportApiError = {
  error: string;
  row?: number;
  max?: number;
};

export type TCsvImportApiResult =
  | { data: TCsvImportApiSuccess; error?: never }
  | { data?: never; error: TCsvImportApiError };

const parseCsvImportApiResponse = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const importCsvFile = async ({
  feedbackSourceId,
  workspaceId,
  file,
}: {
  feedbackSourceId: string;
  workspaceId: string;
  file: File;
}): Promise<TCsvImportApiResult> => {
  const formData = new FormData();
  formData.append("feedbackSourceId", feedbackSourceId);
  formData.append("workspaceId", workspaceId);
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/unify-feedback/sources/csv/import", {
      method: "POST",
      body: formData,
    });
  } catch {
    return { error: { error: CSV_IMPORT_FAILED_ERROR_CODE } };
  }

  const body = await parseCsvImportApiResponse(response);

  if (!response.ok) {
    const errorBody = body as Partial<TCsvImportApiError> | null;
    return {
      error: {
        error: errorBody?.error ?? CSV_IMPORT_FAILED_ERROR_CODE,
        row: errorBody?.row,
        max: errorBody?.max,
      },
    };
  }

  return { data: body as TCsvImportApiSuccess };
};
