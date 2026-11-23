import { z } from "zod";
import {
  ZSendWorkflowTestRequestInput,
  ZSetWorkflowExpectedResponseInput,
  ZWorkflowHttpHeader,
  ZWorkflowHttpQueryParameter,
  ZWorkflowHttpRequestActionConfig,
  ZWorkflowTestRequestParams,
} from "@formbricks/workflows";

/**
 * The step's draft settings, closed at every level so an agent's misspelled key is refused rather than
 * dropped. The operation parses `config` again with the shared schema, which adds the header rules
 * (unique names, refused transport headers) and the limits.
 */
const ZMcpHttpRequestConfig = ZWorkflowHttpRequestActionConfig.extend({
  queryParameters: z.array(ZWorkflowHttpQueryParameter.strict()).optional(),
  headers: z.array(ZWorkflowHttpHeader.strict()).optional(),
}).strict();

export const ZMcpSendTestRequestInput = ZSendWorkflowTestRequestInput.extend({
  ...ZWorkflowTestRequestParams.shape,
  config: ZMcpHttpRequestConfig.optional().describe(
    "The step's draft settings; defaults to the saved step. A secret header without a value uses the saved secret of that name, only if the URL is on the host that secret was set for; one with a value uses that value for this call only."
  ),
})
  .strict()
  .describe("Send one real call of an HTTP request step and get the response.");
export type TMcpSendTestRequestInput = z.infer<typeof ZMcpSendTestRequestInput>;

export const ZMcpSetExpectedResponseInput = ZSetWorkflowExpectedResponseInput.extend({
  ...ZWorkflowTestRequestParams.shape,
})
  .strict()
  .describe("Set an HTTP request step's expected response body: the body its API answers with.");
export type TMcpSetExpectedResponseInput = z.infer<typeof ZMcpSetExpectedResponseInput>;
