import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import { GET as authorize } from "@/modules/ee/auth/saml/api/authorize/route";

export const GET = withAuthRequestBodyLimit(authorize);
