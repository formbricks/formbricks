import type { Membership } from "../types";

/** A survey to alert on, carrying the workspace it belongs to so the list can name it. */
export type TAlertRow = { surveyId: string; surveyName: string; workspaceName: string };

type TWorkspaces = Membership["organization"]["workspaces"];

/**
 * Pinned to one locale rather than left to `localeCompare`'s default, because the list is rendered by a
 * client component: the server sorts under Node's locale and the browser re-sorts under the visitor's,
 * and a collation that disagrees between the two puts the rows in a different order on each side, which
 * is a hydration mismatch. `numeric` is what keeps "Workspace 2" ahead of "Workspace 10".
 */
const collator = new Intl.Collator("en", { numeric: true });

/**
 * Flattens one organization's workspaces into a row per survey, ordered by workspace, then by survey
 * name, then by id.
 *
 * The order carries the workspace column: the query returns surveys grouped by workspace but with no
 * order inside or between those groups, so a workspace's surveys can arrive interleaved with another's
 * and two same-named surveys from different workspaces can land rows apart. Sorting keeps each
 * workspace's surveys together, so the column reads as a group label rather than a value repeated at
 * random. The id breaks the remaining tie, because nothing stops two surveys in one workspace sharing a
 * name — without it their rows could swap places between renders.
 */
export const getAlertRows = (workspaces: TWorkspaces): TAlertRow[] =>
  workspaces
    .flatMap((workspace) =>
      workspace.surveys.map((survey) => ({
        surveyId: survey.id,
        surveyName: survey.name,
        workspaceName: workspace.name,
      }))
    )
    .sort(
      (a, b) =>
        collator.compare(a.workspaceName, b.workspaceName) ||
        collator.compare(a.surveyName, b.surveyName) ||
        collator.compare(a.surveyId, b.surveyId)
    );
