import * as React from "react";

/**
 * Where survey-ui portals (dropdown menus, popovers) mount their content.
 *
 * `null` (the default) mounts them in `document.body`, which is right for surveys shown to
 * respondents. The renderer provides an element only for dashboard previews, so an open dropdown
 * stays inside the preview's containment boundary instead of escaping into the admin app (ENG-3552).
 * The portal content keeps its own `#fbjs` root either way, so the survey's styles, appearance and
 * custom CSS still reach it.
 */
export const SurveyPortalContainerContext = React.createContext<HTMLElement | null>(null);
