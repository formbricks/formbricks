export const DASHBOARD_WIDGET_LOAD_ERROR = "failed_to_load_chart_data" as const;
export const DASHBOARD_WIDGET_DATASET_UNAVAILABLE = "dataset_unavailable" as const;

export type TDashboardWidgetError =
  | typeof DASHBOARD_WIDGET_LOAD_ERROR
  | typeof DASHBOARD_WIDGET_DATASET_UNAVAILABLE;
