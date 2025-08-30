import { NextRequest } from "next/server";
import { z } from "zod";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { createUser } from "@/modules/api/v2/organizations/[organizationId]/users/lib/users";
import { ZUserInput } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";

const ZParams = z.object({ organizationId: z.string().min(1) });

export const POST = async (
  request: NextRequest,
  props: { params: Promise<{ organizationId: string }> }
) => {
  try {
    if (IS_FORMBRICKS_CLOUD) {
      return handleApiError(request, {
        type: "bad_request",
        details: [{ field: "organizationId", issue: "This endpoint is not supported on Formbricks Cloud" }],
      });
    }

    const adminSecret = process.env.ADMIN_OPS_SECRET;
    const providedSecret = request.headers.get("x-admin-secret");
    if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
      return handleApiError(request, { type: "unauthorized" });
    }

    const params = await props.params;
    const paramsParsed = ZParams.safeParse(params);
    if (!paramsParsed.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: paramsParsed.error.issues.map((iss) => ({ field: iss.path.join("."), issue: iss.message })),
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: [{ field: "body", issue: "Invalid JSON" }],
      });
    }

    const parsedBody = ZUserInput.safeParse(body);
    if (!parsedBody.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: parsedBody.error.issues.map((iss) => ({ field: iss.path.join("."), issue: iss.message })),
      });
    }

    const result = await createUser(parsedBody.data, paramsParsed.data.organizationId);
    if (!result.ok) {
      return handleApiError(request, result.error);
    }

    return responses.createdResponse({ data: result.data });
  } catch (error: any) {
    return handleApiError(request, {
      type: "internal_server_error",
      details: [{ field: "error", issue: error?.message ?? "Unknown error" }],
    });
  }
};


