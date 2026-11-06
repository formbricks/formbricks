import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";

/** What a recheck found: whether the license is active, and its status or why it isn't. */
export type TLicenseCheckResource = {
  active: boolean;
  status: TLicenseStatus | "invalid_license";
};

/** `POST /api/internal/license-checks?workspaceId=`: the workspace whose organization asks. */
export const ZLicenseCheckQuery = z.object({ workspaceId: ZId }).strict();
