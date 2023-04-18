export interface ResponseCreateRequest {
  surveyId: string;
  personId?: string;
  response: {
    finished?: boolean;
    data: {
      [name: string]: string | number | string[] | number[] | undefined;
    };
  };
}

export interface ResponseUpdateRequest {
  response: {
    finished?: boolean;
    data: {
      [name: string]: string | number | string[] | number[] | undefined;
    };
  };
}

export interface Response {
  id: string;
  createdAt: string;
  updatedAt: string;
  organisationId: string;
  formId: string;
  customerId: string;
  data: {
    [name: string]: string | number | string[] | number[] | undefined;
  };
}

export const createResponse = async (
  responseRequest: ResponseCreateRequest,
  apiHost: string,
  environmentId: string
): Promise<Response> => {
  const res = await fetch(`${apiHost}/api/v1/client/environments/${environmentId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  return await res.json();
};

export const updateResponse = async (
  responseRequest: ResponseUpdateRequest,
  responseId: string,
  apiHost: string,
  environmentId: string
): Promise<Response> => {
  const res = await fetch(`${apiHost}/api/v1/client/environments/${environmentId}/responses/${responseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
  });
  if (!res.ok) {
    throw new Error("Could not update response");
  }
  return await res.json();
};
