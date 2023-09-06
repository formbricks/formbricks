import { IHookFunctions, ILoadOptionsFunctions } from "n8n-core";
import {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  INodePropertyOptions,
  JsonObject,
  NodeApiError,
  NodeOperationError,
} from "n8n-workflow";

/**
 * Make an API request to Formbricks
 */
export async function apiRequest(
  this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  resource: string,
  body: object,
  query: IDataObject = {},
  option: IDataObject = {}
): Promise<any> {
  const credentials = await this.getCredentials("formbricksApi");

  let options: IHttpRequestOptions = {
    baseURL: `${credentials.host}/api/v1`,
    method,
    body,
    qs: query,
    url: resource,
    headers: {
      "x-Api-Key": credentials.apiKey,
    },
  };

  if (!Object.keys(query).length) {
    delete options.qs;
  }

  options = Object.assign({}, options, option);
  try {
    return await this.helpers.httpRequestWithAuthentication.call(this, "formbricksApi", options);
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject);
  }
}

/**
 * Returns all the available surveys
 */
export async function getSurveys(this: ILoadOptionsFunctions): Promise<any> {
  const endpoint = "/surveys";
  const responseData = await apiRequest.call(this, "GET", endpoint, {});

  if (!responseData.data) {
    throw new NodeOperationError(this.getNode(), "No data got returned");
  }

  const returnData: INodePropertyOptions[] = [];
  for (const data of responseData.data) {
    returnData.push({
      name: data.name,
      value: data.id,
    });
  }

  return returnData;
}
