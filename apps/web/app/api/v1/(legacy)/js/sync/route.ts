import { responses } from "@/app/lib/api/response";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (req: Request): Promise<Response> => {
  try {
    const jsonInput = await req.json();

    console.log("legacy sync called by environmentId: ", jsonInput.environmentId);

    return responses.goneResponse(
      "This endpoint is deprecated",
      { message: "Please upgrade to the latest version of @formbricks/js" },
      true
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
