import "server-only";
import { Result } from "@formbricks/types/error-handlers";

export const testEndpoint = async (url: string): Promise<Result<boolean>> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        event: "testEndpoint",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      return { ok: true, data: true };
    } else {
      const errorMessage = await response.text();
      return {
        ok: false,
        error: new Error(`Request failed with status code ${statusCode}: ${errorMessage}`),
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: new Error(`Error while fetching the URL: ${error.message}`),
    };
  }
};
