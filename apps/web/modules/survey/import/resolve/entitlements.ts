import { importWarning } from "../report";
import type { TImportIssue } from "../types";
import { isRecord } from "./paths";

const ENDING_FALLBACK_HEADLINE = "Thank you!";

/** Does the document use anything gated behind the external-URL entitlement? */
export function hasImportExternalUrls(document: Record<string, unknown>): boolean {
  const endings = Array.isArray(document.endings) ? document.endings : [];
  const hasEndingUrl = endings.some(
    (ending) =>
      isRecord(ending) &&
      ((ending.type === "endScreen" && Boolean(ending.buttonLink)) ||
        (ending.type === "redirectToUrl" && Boolean(ending.url)))
  );
  if (hasEndingUrl) return true;

  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  return blocks.some(
    (block) =>
      isRecord(block) &&
      Array.isArray(block.elements) &&
      block.elements.some(
        (element) =>
          isRecord(element) &&
          element.type === "cta" &&
          (element.buttonExternal === true || element.buttonUrl)
      )
  );
}

/** Every language the document declares, default first — a new i18n field must carry all of them. */
function getDocumentLanguageCodes(document: Record<string, unknown>): string[] {
  const codes = new Set<string>();
  codes.add(typeof document.defaultLanguage === "string" ? document.defaultLanguage : "en-US");
  if (Array.isArray(document.languages)) {
    for (const language of document.languages) {
      if (isRecord(language) && typeof language.code === "string") codes.add(language.code);
    }
  }
  return Array.from(codes);
}

/**
 * Strip every external URL when the organization is not entitled to them: CTA buttons become plain
 * "next" buttons, ending links go, redirect endings turn into an end screen. The survey still works.
 */
export function stripImportExternalUrls(document: Record<string, unknown>): TImportIssue[] {
  const issues: TImportIssue[] = [];
  const languageCodes = getDocumentLanguageCodes(document);

  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || !Array.isArray(block.elements)) return;
    block.elements.forEach((element, elementIndex) => {
      if (!isRecord(element) || element.type !== "cta") return;
      if (element.buttonExternal !== true && !element.buttonUrl) return;

      element.buttonExternal = false;
      delete element.buttonUrl;
      issues.push(
        importWarning({
          code: "external_url_removed",
          path: `blocks.${blockIndex}.elements.${elementIndex}.buttonUrl`,
        })
      );
    });
  });

  const endings = Array.isArray(document.endings) ? document.endings : [];
  endings.forEach((ending, index) => {
    if (!isRecord(ending)) return;

    if (ending.type === "endScreen" && ending.buttonLink) {
      delete ending.buttonLink;
      delete ending.buttonLabel;
      issues.push(importWarning({ code: "external_url_removed", path: `endings.${index}.buttonLink` }));
      return;
    }

    if (ending.type === "redirectToUrl") {
      const headline =
        typeof ending.label === "string" && ending.label.trim() ? ending.label : ENDING_FALLBACK_HEADLINE;
      endings[index] = {
        id: ending.id,
        type: "endScreen",
        headline: Object.fromEntries(languageCodes.map((code) => [code, headline])),
      };
      issues.push(importWarning({ code: "external_url_removed", path: `endings.${index}.url` }));
    }
  });

  return issues;
}
