// Simple API client using fetch
export class ApiClient {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  private async request(endpoint: string, method: string, data?: any) {
    const url = `${this.apiHost}/api/v1/client/${this.environmentId}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request error:", error);
      throw error;
    }
  }

  async createDisplay(surveyId: string, userId?: string) {
    return this.request("displays", "POST", {
      surveyId,
      ...(userId && { userId }),
    });
  }

  async createResponse(data: any) {
    return this.request("responses", "POST", data);
  }

  async updateResponse(responseId: string, data: any) {
    return this.request(`responses/${responseId}`, "PUT", data);
  }

  async uploadFile(file: any, params: any) {
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    const url = `${this.apiHost}/api/v1/client/storage/upload`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-environment-id": this.environmentId,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("File upload failed");
    }

    return await response.json();
  }
}
