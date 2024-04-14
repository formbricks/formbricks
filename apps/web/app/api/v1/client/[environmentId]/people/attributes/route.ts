import { responses } from "@/app/lib/api/response";

export async function OPTIONS() {
  // cors headers
  return responses.successResponse({}, true);
}

export async function PUT() {
  // cors headers
  return responses.successResponse({}, true);
}
