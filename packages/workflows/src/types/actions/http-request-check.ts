import { findWorkflowRecallTokens } from "../../variables/insert";
import { parseWorkflowVariablePath } from "../../variables/paths";
import { type TWorkflowExecutableCheckContext, checkWorkflowVariableRef } from "../executable-checks";
import { type TWorkflowHttpRequestActionNode, WORKFLOW_HTTP_METHODS_WITH_BODY } from "./http-request";

const checkVariablesIn = (
  text: string,
  context: TWorkflowExecutableCheckContext,
  path: (string | number)[]
): void => {
  for (const token of findWorkflowRecallTokens(text)) {
    const parsed = parseWorkflowVariablePath(token.path);
    if (parsed.ok) {
      checkWorkflowVariableRef({ path: token.path }, context, path);
    } else {
      context.addIssue(parsed.error, path);
    }
  }
};

const isHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * What an `http_request` step needs to run, beyond the persisted schema: a real URL, a body only where
 * the method sends one (and that body a JSON template), every secret header with a stored value (a
 * duplicate keeps the names but not the values), and Variables this step can see. Whether the URL is
 * allowed (HTTPS, public address) depends on the instance and is checked when the request is sent.
 */
export const checkHttpRequest = (
  node: TWorkflowHttpRequestActionNode,
  context: TWorkflowExecutableCheckContext
): void => {
  const { config } = node;
  if (!isHttpUrl(config.url)) {
    context.addIssue(`http_request node ${node.id} needs an absolute http(s) URL`, ["config", "url"]);
  }

  const hasBody = typeof config.body === "string" && config.body.trim() !== "";
  if (hasBody && !WORKFLOW_HTTP_METHODS_WITH_BODY.has(config.method)) {
    context.addIssue(`http_request node ${node.id} can only send a body with POST, PUT or PATCH`, [
      "config",
      "body",
    ]);
  } else if (hasBody && !isJson(config.body as string)) {
    context.addIssue(`http_request node ${node.id} body is not valid JSON`, ["config", "body"]);
  }
  if (hasBody) checkVariablesIn(config.body as string, context, ["config", "body"]);

  for (const [index, parameter] of config.queryParameters.entries()) {
    checkVariablesIn(parameter.value, context, ["config", "queryParameters", index, "value"]);
  }

  for (const [index, header] of config.headers.entries()) {
    if (header.secret === true) {
      if (!header.secretId) {
        context.addIssue(`Secret header ${header.name} has no value; enter it again`, [
          "config",
          "headers",
          index,
        ]);
      }
      continue;
    }
    checkVariablesIn(header.value ?? "", context, ["config", "headers", index, "value"]);
  }
};
