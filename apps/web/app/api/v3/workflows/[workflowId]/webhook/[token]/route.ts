/**
 * POST /api/v3/workflows/{workflowId}/webhook/{token} — the Webhook Secret URL (ENG-7177). No login: the
 * token in the path is the credential (ADR 0057), so the path is redacted before anything records it,
 * and the handler does its own rate limiting (the wrapper's needs an authenticated principal) and reads
 * and bounds its own body. With PUBLIC_URL configured, only this receiver is served on the public domain.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { redactWebhookTokens } from "@/lib/utils/redact-webhook-token";
import { receiveWorkflowWebhookCall } from "@/modules/ee/workflows/lib/webhook/receive-webhook-call";

interface TWebhookRouteProps {
  params: Promise<{ workflowId: string; token: string }>;
}

export const POST = withV3ApiWrapper<undefined, TWebhookRouteProps>({
  auth: "none",
  rateLimit: false,
  handlerReadsBody: true,
  // Servers call it, with no Origin, and the token in the path is its only credential: no browser
  // credential rides on it, so the cross-origin check for pre-login writes has nothing to protect.
  allowCrossOrigin: true,
  redactPath: redactWebhookTokens,
  handler: async ({ req, props, requestId, instance }) => {
    const { workflowId, token } = await props.params;
    return receiveWorkflowWebhookCall({ req, workflowId, token, requestId, instance });
  },
});
