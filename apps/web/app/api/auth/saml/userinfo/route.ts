import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import { GET as userinfo } from "@/modules/ee/auth/saml/api/userinfo/route";

export const GET = withAuthRequestBodyLimit(userinfo);
