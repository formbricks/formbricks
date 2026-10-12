import { SURVEY_PREVIEW_BOUNDARY_ATTRIBUTE } from "@formbricks/types/formbricks-surveys";

/**
 * The element a preview survey's dropdown portals mount in: the closest dashboard-marked, contained
 * box around the inline survey, or `null` (→ `<body>`) when there is none, which is every respondent
 * surface. Matched on the attribute alone, so a host that never sets it is unaffected.
 */
export const getPreviewPortalContainer = (element: Element): HTMLElement | null =>
  element.closest<HTMLElement>(`[${SURVEY_PREVIEW_BOUNDARY_ATTRIBUTE}]`);
