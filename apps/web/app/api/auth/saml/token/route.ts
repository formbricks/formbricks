import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import { POST as token } from "@/modules/ee/auth/saml/api/token/route";

export const POST = withAuthRequestBodyLimit(token);
