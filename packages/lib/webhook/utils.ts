import "server-only";
import { UnknownError } from "@formbricks/types/errors";

export const testEndpoint = async (url: string): Promise<boolean> => {
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
      return true;
    } else {
      const errorMessage = await response.text();
      throw new UnknownError(`Request failed with status code ${statusCode}: ${errorMessage}`);
    }
  } catch (error) {
    throw new UnknownError(`Error while fetching the URL: ${error.message}`);
  }
};
