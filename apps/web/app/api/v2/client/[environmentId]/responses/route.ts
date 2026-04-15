import { responses } from "@/app/lib/api/response";
import { handleCreateResponseRequest } from "./lib/post-response-handler";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const { environmentId } = await context.params;
  return handleCreateResponseRequest({ environmentId, req: request });
};
