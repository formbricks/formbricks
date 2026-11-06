/**
 * What a chart shows in place of its plot when there is nothing to draw: no rows, or (on a dashboard)
 * a filter it cannot be narrowed by. One look for every such case, so a reason reads like no data.
 */
export const ChartEmptyState = ({ message }: Readonly<{ message: string }>) => (
  <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center px-4 text-center">
    {message}
  </div>
);
