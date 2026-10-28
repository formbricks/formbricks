/** `value` as JSON with object keys sorted, so two queries built in a different key order compare equal. */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
      : nested
  );

/**
 * The update the editor sends for a chart it loaded: the name and display settings always, the type and
 * query only when they differ from what was loaded. Changing what a chart reads needs write access to its
 * Feedback Dataset and a rename does not, so a rename stays a rename — and works for a chart whose dataset
 * was since unassigned from the workspace.
 */
export const chartUpdateFromEditor = <TType extends string, TQuery, TConfig>(
  edited: { name: string; type: TType; query: TQuery; config: TConfig },
  loaded: { type: TType; query: TQuery } | null
): { name: string; config: TConfig; type?: TType; query?: TQuery } => ({
  name: edited.name,
  config: edited.config,
  ...(loaded?.type === edited.type ? {} : { type: edited.type }),
  ...(loaded && canonicalJson(loaded.query) === canonicalJson(edited.query) ? {} : { query: edited.query }),
});
