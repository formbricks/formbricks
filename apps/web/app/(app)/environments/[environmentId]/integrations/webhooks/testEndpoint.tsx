"use server";
import "server-only";

export const testEndpoint = async (url: string) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        formbricks: "test endpoint",
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
      throw new Error(`Request failed with status code ${statusCode}: ${errorMessage}`);
    }
  } catch (error) {
    throw new Error(`Error while fetching the URL: ${error.message}`);
  }
};
