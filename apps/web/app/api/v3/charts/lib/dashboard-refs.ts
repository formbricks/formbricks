/**
 * The dashboards a chart's widgets sit on, each once, in the order given: a chart may sit on several pages
 * of one dashboard, and still names that dashboard once.
 */
export const uniqueDashboards = <T extends { id: string; name: string }>(
  dashboards: T[]
): { id: string; name: string }[] => {
  const seen = new Set<string>();
  return dashboards.flatMap(({ id, name }) => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, name }];
  });
};
