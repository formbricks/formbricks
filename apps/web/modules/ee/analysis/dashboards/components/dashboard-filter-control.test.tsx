import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import type { TDashboardFilter } from "../lib/dashboard-filters";
import { DashboardFilterControl } from "./dashboard-filter-control";
import { moveDashboardFilter } from "./dashboard-filter-editor";

vi.mock("@/modules/ee/analysis/lib/api-client", () => ({ listDashboardFilterValues: vi.fn() }));

const DASHBOARD_ID = "cldb000000000000000000001";
const SOURCE: TDashboardFilter = {
  id: "clfi000000000000000000001",
  field: "FeedbackRecords.sourceName",
  operator: "equals",
  label: "Source",
};
const COUNTRY: TDashboardFilter = {
  id: "clfi000000000000000000002",
  field: "FeedbackRecords.metadataCountry",
  operator: "equals",
  label: "Country",
};
const ANSWER: TDashboardFilter = {
  id: "clfi000000000000000000003",
  field: "FeedbackRecords.valueText",
  operator: "contains",
  label: "Answer",
};

const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  vi.mocked(listDashboardFilterValues).mockResolvedValue({
    values: [{ value: "Email" }, { value: "Web" }],
    hasMore: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardFilterControl", () => {
  test("loads the value list only when it opens, narrowed by the other picks and the date, not its own", async () => {
    const onChange = vi.fn();
    render(
      <DashboardFilterControl
        dashboardId={DASHBOARD_ID}
        filter={SOURCE}
        picks={{ [COUNTRY.id]: ["IT"] }}
        dateRange="last 7 days"
        onChange={onChange}
      />,
      { wrapper }
    );
    expect(listDashboardFilterValues).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Source" }));

    await screen.findByText("Web");
    expect(listDashboardFilterValues).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: DASHBOARD_ID,
        filterId: SOURCE.id,
        dateRange: "last 7 days",
        picks: { [COUNTRY.id]: ["IT"] },
      })
    );

    fireEvent.click(screen.getByLabelText("Web"));
    expect(onChange).toHaveBeenCalledWith(["Web"]);
  });

  test("keeps an active pick listed and ticked when the narrowed list no longer has it, and clears it", async () => {
    const onChange = vi.fn();
    render(
      <DashboardFilterControl
        dashboardId={DASHBOARD_ID}
        filter={SOURCE}
        picks={{ [SOURCE.id]: ["Fax"] }}
        dateRange={null}
        onChange={onChange}
      />,
      { wrapper }
    );

    expect(screen.getByText(": Fax")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Source/ }));
    await screen.findByText("Web");
    expect(screen.getByLabelText("Fax")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "common.table_toolbar.remove_filter" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test("takes one typed value for a filter that is not a list, without loading values", async () => {
    const onChange = vi.fn();
    render(
      <DashboardFilterControl
        dashboardId={DASHBOARD_ID}
        filter={ANSWER}
        picks={{}}
        dateRange={null}
        onChange={onChange}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    fireEvent.change(await screen.findByLabelText("Answer"), { target: { value: "  late delivery " } });
    fireEvent.click(screen.getByRole("button", { name: "workspace.analysis.dashboards.filter_apply" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["late delivery"]));
    expect(listDashboardFilterValues).not.toHaveBeenCalled();
  });
});

describe("moveDashboardFilter", () => {
  test("swaps a filter with its neighbour and stays put at either end", () => {
    const filters = [SOURCE, COUNTRY, ANSWER];
    expect(moveDashboardFilter(filters, 1, -1)).toEqual([COUNTRY, SOURCE, ANSWER]);
    expect(moveDashboardFilter(filters, 1, 1)).toEqual([SOURCE, ANSWER, COUNTRY]);
    expect(moveDashboardFilter(filters, 0, -1)).toEqual(filters);
    expect(moveDashboardFilter(filters, 2, 1)).toEqual(filters);
  });
});
