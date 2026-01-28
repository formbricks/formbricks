export type TDashboardStatus = "published" | "draft";

export interface TAnalysisUser {
  id: string;
  name: string;
}

export interface TDashboard {
  id: string;
  name: string;
  description?: string;
  status: TDashboardStatus;
  owners: TAnalysisUser[];
  lastModified: string; // ISO Date string
  isFavorite: boolean;
  widgets: TDashboardWidget[];
}

export interface TDashboardWidget {
  id: string;
  type: "chart" | "markdown" | "header" | "divider";
  title?: string;
  chartId?: string; // If type is chart
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  chart?: {
    id: string;
    name: string;
    type: TChartType;
    query: Record<string, any>;
    config: Record<string, any>;
  };
}

export type TChartType =
  | "area"
  | "bar"
  | "line"
  | "pie"
  | "big_number"
  | "big_number_total"
  | "table"
  | "funnel"
  | "map";

export interface TChart {
  id: string;
  name: string;
  type: TChartType;
  dataset: string;
  owners: TAnalysisUser[];
  lastModified: string;
  dashboardIds: string[];
  config: Record<string, any>; // Flexible config for specific chart props
}

export interface TAnalysisState {
  dashboards: TDashboard[];
  charts: TChart[];
  activeDashboard: TDashboard | null;
  layoutMode: "view" | "edit";
  isLoading: boolean;

  // Actions
  setDashboards: (dashboards: TDashboard[]) => void;
  setCharts: (charts: TChart[]) => void;
  setActiveDashboard: (dashboard: TDashboard | null) => void;
  setLayoutMode: (mode: "view" | "edit") => void;
  addDashboard: (dashboard: TDashboard) => void;
  updateDashboard: (id: string, updates: Partial<TDashboard>) => void;
}
