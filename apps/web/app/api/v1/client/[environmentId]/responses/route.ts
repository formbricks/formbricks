import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { handleCreateResponseRequest } from "./lib/post-response-handler";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true, "public, s-maxage=3600, max-age=3600");
};

export const POST = withV1ApiWrapper({
  handler: handleCreateResponseRequest,
});
