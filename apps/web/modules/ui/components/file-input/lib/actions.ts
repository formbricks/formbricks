"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client/action-client";
import { z } from "zod";

const ZConvertHeicToJpegInput = z.object({
  file: z.instanceof(File),
});

export const convertHeicToJpegAction = authenticatedActionClient
  .schema(ZConvertHeicToJpegInput)
  .action(async ({ parsedInput }) => {
    if (!parsedInput.file || !parsedInput.file.name.endsWith(".heic")) return parsedInput.file;

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
