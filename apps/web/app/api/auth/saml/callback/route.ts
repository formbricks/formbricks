import {
  SAML_CALLBACK_BODY_LIMIT_BYTES,
  withAuthRequestBodyLimit,
} from "@/modules/auth/lib/auth-request-body-limit";
import { POST as callback } from "@/modules/ee/auth/saml/api/callback/route";

export const POST = withAuthRequestBodyLimit(callback, SAML_CALLBACK_BODY_LIMIT_BYTES);
