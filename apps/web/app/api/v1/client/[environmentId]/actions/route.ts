// DEPRECATED
// Storing actions on the server is deprecated and no longer supported.
import { responses } from "@/app/lib/api/response";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};
