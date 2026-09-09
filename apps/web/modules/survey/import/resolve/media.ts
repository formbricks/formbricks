import { isValidVideoUrl } from "@/lib/utils/video-upload";
import { isValidImageFile } from "@/modules/storage/utils";
import { importInfo, importWarning } from "../report";
import type { TImportIssue } from "../types";
import { isRecord } from "./paths";

type TMediaKind = "image" | "video";

type TMediaSlot = { container: Record<string, unknown>; key: string; path: string; kind: TMediaKind };

function collectElementMedia(document: Record<string, unknown>, slots: TMediaSlot[]): void {
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return;
    block.elements.forEach((element, elementIndex) => {
      if (!isRecord(element)) return;
      const base = `blocks.${blockIndex}.elements.${elementIndex}`;
      slots.push({ container: element, key: "imageUrl", path: `${base}.imageUrl`, kind: "image" });
      slots.push({ container: element, key: "videoUrl", path: `${base}.videoUrl`, kind: "video" });
      if (element.type === "pictureSelection" && Array.isArray(element.choices)) {
        element.choices.forEach((choice, choiceIndex) => {
          if (isRecord(choice)) {
            slots.push({
              container: choice,
              key: "imageUrl",
              path: `${base}.choices.${choiceIndex}.imageUrl`,
              kind: "image",
            });
          }
        });
      }
    });
  });
}

function collectMediaSlots(document: Record<string, unknown>): TMediaSlot[] {
  const slots: TMediaSlot[] = [];
  collectElementMedia(document, slots);

  if (isRecord(document.welcomeCard)) {
    slots.push({
      container: document.welcomeCard,
      key: "fileUrl",
      path: "welcomeCard.fileUrl",
      kind: "image",
    });
    slots.push({
      container: document.welcomeCard,
      key: "videoUrl",
      path: "welcomeCard.videoUrl",
      kind: "video",
    });
  }

  const endings = Array.isArray(document.endings) ? document.endings : [];
  endings.forEach((ending, index) => {
    if (!isRecord(ending)) return;
    slots.push({ container: ending, key: "imageUrl", path: `endings.${index}.imageUrl`, kind: "image" });
    slots.push({ container: ending, key: "videoUrl", path: `endings.${index}.videoUrl`, kind: "video" });
  });

  if (isRecord(document.metadata)) {
    slots.push({ container: document.metadata, key: "ogImage", path: "metadata.ogImage", kind: "image" });
  }

  return slots;
}

function isForeignAsset(url: string, instanceUrl: string | undefined): boolean {
  if (url.startsWith("/")) return false;
  try {
    const parsed = new URL(url);
    if (!instanceUrl) return true;
    return parsed.origin !== new URL(instanceUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Media is validated the way the write path validates it (image extension allowlist, YouTube/Vimeo/
 * Loom only); anything invalid is removed with a warning so the create call cannot fail on it.
 * Picture-selection choices are the exception: their image is the choice, so an invalid one stays
 * and the create-side validation reports it. Images hosted by another instance keep working only as
 * long as that instance serves them, hence the info line.
 */
export function resolveImportMedia(document: Record<string, unknown>, instanceUrl?: string): TImportIssue[] {
  const issues: TImportIssue[] = [];
  let reportedForeign = false;

  for (const slot of collectMediaSlots(document)) {
    const url = slot.container[slot.key];
    if (typeof url !== "string" || url.length === 0) continue;

    const valid = slot.kind === "image" ? isValidImageFile(url) : isValidVideoUrl(url);
    if (!valid) {
      if (slot.path.includes(".choices.")) continue;
      delete slot.container[slot.key];
      issues.push(importWarning({ code: "media_invalid", path: slot.path, vars: { url } }));
      continue;
    }

    if (slot.kind === "image" && !reportedForeign && isForeignAsset(url, instanceUrl)) {
      reportedForeign = true;
      issues.push(importInfo({ code: "asset_url_external", path: slot.path }));
    }
  }

  return issues;
}
