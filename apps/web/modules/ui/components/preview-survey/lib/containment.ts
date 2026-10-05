import { SURVEY_PREVIEW_BOUNDARY_ATTRIBUTE } from "@formbricks/types/formbricks-surveys";

/**
 * Preview containment (ENG-3552). Customer CSS only ever reaches `#fbjs` and what is inside it, so a
 * box around the survey that sits outside `#fbjs` is trusted: nothing a customer writes can restyle it.
 * Each dashboard preview wraps its survey "screen" — never the chrome with the dashboard's own
 * controls — in such a box, which:
 *
 * - clips everything painted inside it (`contain: paint` + `overflow: hidden`), so absolutely
 *   positioned or oversized survey content cannot paint over the editor around it;
 * - is the containing block for fixed and absolute descendants (`contain: layout` + `relative`), so a
 *   fixed-position popper is positioned and clipped here instead of against the viewport;
 * - is its own stacking context (`isolation: isolate`), so a customer `z-index: 2147483647` stays
 *   below every dashboard control outside it;
 * - carries the boundary attribute, so the renderer mounts dropdown portals inside it rather than in
 *   `<body>` (see `getPreviewPortalContainer` in packages/surveys).
 *
 * Every box that gets these already clipped at the same edges (or is the full-size child of one that
 * does), so the normal preview layout is unchanged.
 */
export const PREVIEW_BOUNDARY_CLASS_NAME = "relative isolate overflow-hidden [contain:layout_paint]";

export const previewBoundaryProps = { [SURVEY_PREVIEW_BOUNDARY_ATTRIBUTE]: "" } as const;
