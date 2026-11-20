"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ZConvertHeicToJpegInput = z.object({
  file: z.instanceof(File),
});

export const convertHeicToJpegAction = authenticatedActionClient
  .inputSchema(ZConvertHeicToJpegInput)
  .action(async ({ ctx, parsedInput }) => {
    if (!parsedInput.file || !parsedInput.file.name.endsWith(".heic")) return parsedInput.file;

    await applyRateLimit(rateLimitConfigs.actions.heicConvert, ctx.user.id);

    const convert = (await import("heic-convert")).default;

    const arrayBuffer = await parsedInput.file.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer) as unknown as ArrayBufferLike;

    const convertedBuffer = await convert({
      buffer: nodeBuffer,
      format: "JPEG",
      quality: 0.9,
    });

    return new File([convertedBuffer], parsedInput.file.name.replace(/\.heic$/, ".jpg"), {
      type: "image/jpeg",
    });
  });
