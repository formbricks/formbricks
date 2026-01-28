import { create } from "zustand";

// --- Types ---

export type DashboardStatus = "published" | "draft";

export interface AnalysisUser {
  id: string;
  name: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  status: DashboardStatus;
  owners: AnalysisUser[];
  lastModified: string; // ISO Date string
  isFavorite: boolean;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
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
}

export type ChartType =
  | "area"
  | "bar"
  | "line"
  | "pie"
  | "big_number"
  | "big_number_total"
  | "table"
  | "funnel"
  | "map";

export interface Chart {
  id: string;
  name: string;
  type: ChartType;
  dataset: string;
  owners: AnalysisUser[];
  lastModified: string;
  dashboardIds: string[];
  config: Record<string, any>; // Flexible config for specific chart props
}

interface AnalysisState {
  dashboards: Dashboard[];
  charts: Chart[];
  activeDashboard: Dashboard | null;
  layoutMode: "view" | "edit";
  isLoading: boolean;

  // Actions
  setDashboards: (dashboards: Dashboard[]) => void;
  setCharts: (charts: Chart[]) => void;
  setActiveDashboard: (dashboard: Dashboard | null) => void;
  setLayoutMode: (mode: "view" | "edit") => void;
  addDashboard: (dashboard: Dashboard) => void;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => void;
}

// --- Mock Data ---

const MOCK_USERS: AnalysisUser[] = [
  { id: "u1", name: "Admin User" },
  { id: "u2", name: "Jane Doe" },
];

const MOCK_CHARTS: Chart[] = [
  {
    id: "c1",
    name: "Gender",
    type: "pie",
    dataset: "FCC 2018 Survey",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 3).toISOString(), // 3 mins ago
    dashboardIds: ["d1"],
    config: {},
  },
  {
    id: "c2",
    name: "Cross Channel Relationship",
    type: "bar", // Using bar as approximation for chord if not available
    dataset: "users_channels-uzooNNtSRO",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    dashboardIds: ["d2"],
    config: {},
  },
  {
    id: "c3",
    name: "Weekly Messages",
    type: "line",
    dataset: "messages",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(), // 14 mins ago
    dashboardIds: ["d2"],
    config: {},
  },
  {
    id: "c4",
    name: "New Members per Month",
    type: "line",
    dataset: "new_members_daily",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    dashboardIds: ["d2"],
    config: {},
  },
  {
    id: "c5",
    name: "Number of Members",
    type: "big_number",
    dataset: "users",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    dashboardIds: ["d2"],
    config: {},
  },
];

const MOCK_DASHBOARDS: Dashboard[] = [
  {
    id: "d1",
    name: "FCC New Coder Survey 2018",
    status: "published",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    isFavorite: true,
    widgets: [],
  },
  {
    id: "d2",
    name: "Slack Dashboard",
    status: "published",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    isFavorite: true,
    widgets: [],
  },
  {
    id: "d3",
    name: "Sales Dashboard",
    status: "published",
    owners: [MOCK_USERS[0]],
    lastModified: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    isFavorite: true,
    widgets: [],
  },
];

// --- Store ---

export const useAnalysisStore = create<AnalysisState>((set) => ({
  dashboards: MOCK_DASHBOARDS,
  charts: MOCK_CHARTS,
  activeDashboard: null,
  layoutMode: "view",
  isLoading: false,

  setDashboards: (dashboards) => set({ dashboards }),
  setCharts: (charts) => set({ charts }),
  setActiveDashboard: (activeDashboard) => set({ activeDashboard }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  addDashboard: (dashboard) => set((state) => ({ dashboards: [...state.dashboards, dashboard] })),
  updateDashboard: (id, updates) =>
    set((state) => ({
      dashboards: state.dashboards.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
}));
