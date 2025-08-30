import { NextRequest } from "next/server";
import { z } from "zod";
import { createOrganization } from "@/lib/organization/service";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";

const ZCreateOrganizationBody = z.object({
  name: z.string().min(1),
});

export const POST = async (request: NextRequest) => {
  try {
    if (IS_FORMBRICKS_CLOUD) {
      return handleApiError(request, {
        type: "bad_request",
        details: [{ field: "organization", issue: "This endpoint is not supported on Formbricks Cloud" }],
      });
    }

    const adminSecret = process.env.ADMIN_OPS_SECRET;
    const providedSecret = request.headers.get("x-admin-secret");
    if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
      return handleApiError(request, { type: "unauthorized" });
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

    const parsed = ZCreateOrganizationBody.safeParse(body);
    if (!parsed.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: parsed.error.issues.map((iss) => ({ field: iss.path.join("."), issue: iss.message })),
      });
    }

    const organization = await createOrganization({ name: parsed.data.name });

    return responses.createdResponse({ data: organization });
  } catch (error: any) {
    return handleApiError(request, {
      type: "internal_server_error",
      details: [{ field: "error", issue: error?.message ?? "Unknown error" }],
    });
  }
};


