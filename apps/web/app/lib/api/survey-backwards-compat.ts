/**
 * Backwards compatibility layer for the project → workspace rename in survey APIs.
 *
 * Old API consumers may send `projectOverwrites` instead of `workspaceOverwrites` in
 * survey create/update request bodies. These utilities normalise the input to the new
 * field name and enrich responses with the legacy `projectOverwrites` field so existing
 * integrations keep working.
 */

// ---------------------------------------------------------------------------
// Input transformation: accept `projectOverwrites` as an alias for `workspaceOverwrites`
// ---------------------------------------------------------------------------

/**
 * Normalise a survey request body so that `projectOverwrites` is mapped to `workspaceOverwrites`.
 * If both are provided, `workspaceOverwrites` takes precedence.
 */
export const normaliseProjectOverwritesToWorkspace = <T extends Record<string, unknown>>(input: T): T => {
  if ("projectOverwrites" in input && !("workspaceOverwrites" in input)) {
    const { projectOverwrites, ...rest } = input;
    return { ...rest, workspaceOverwrites: projectOverwrites } as unknown as T;
  }

  // Drop stale projectOverwrites if workspaceOverwrites is already present
  if ("projectOverwrites" in input && "workspaceOverwrites" in input) {
    const { projectOverwrites: _, ...rest } = input;
    return rest as unknown as T;
  }

  return input;
};

// ---------------------------------------------------------------------------
// Output transformation: include legacy `projectOverwrites` alongside `workspaceOverwrites`
// ---------------------------------------------------------------------------

/**
 * Add `projectOverwrites` to a survey response object, mirroring `workspaceOverwrites`.
 */
export const addLegacyProjectOverwrites = <T extends Record<string, unknown>>(survey: T): T => {
  if ("workspaceOverwrites" in survey) {
    return { ...survey, projectOverwrites: survey.workspaceOverwrites };
  }
  return survey;
};

/**
 * Add `projectOverwrites` to each survey in a list response.
 */
export const addLegacyProjectOverwritesToList = <T extends Record<string, unknown>>(surveys: T[]): T[] =>
  surveys.map(addLegacyProjectOverwrites);

// ---------------------------------------------------------------------------
// Environment state output: include legacy `project` key alongside `workspace`
// ---------------------------------------------------------------------------

/**
 * Enrich an environment state data object to include legacy `project` key
 * alongside `workspace` so old SDK consumers still see the field they expect.
 */
export const addLegacyProjectToEnvironmentState = <T extends Record<string, unknown>>(data: T): T => {
  if ("workspace" in data && !("project" in data)) {
    return { ...data, project: data.workspace };
  }
  return data;
};
