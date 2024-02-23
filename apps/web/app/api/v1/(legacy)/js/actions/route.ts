import { responses } from "@/app/lib/api/response";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function POST(): Promise<Response> {
  return responses.successResponse({}, true);
}
