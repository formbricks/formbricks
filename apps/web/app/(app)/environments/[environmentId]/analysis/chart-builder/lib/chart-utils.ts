// Chart type mapping from API to database
export const mapChartType = (
  apiType: string
): "area" | "bar" | "line" | "pie" | "big_number" | "big_number_total" | "table" | "funnel" | "map" => {
  const mapping: Record<
    string,
    "area" | "bar" | "line" | "pie" | "big_number" | "big_number_total" | "table" | "funnel" | "map"
  > = {
    bar: "bar",
    line: "line",
    area: "area",
    pie: "pie",
    donut: "pie",
    kpi: "big_number",
  };
  return mapping[apiType] || "bar";
};

// Reverse mapping from database chart type to API chart type
export const mapDatabaseChartTypeToApi = (
  dbType: string
): "bar" | "line" | "donut" | "kpi" | "area" | "pie" => {
  const mapping: Record<string, "bar" | "line" | "donut" | "kpi" | "area" | "pie"> = {
    bar: "bar",
    line: "line",
    area: "area",
    pie: "pie",
    big_number: "kpi",
    big_number_total: "kpi",
    table: "bar", // Default fallback
    funnel: "bar", // Default fallback
    map: "bar", // Default fallback
  };
  return mapping[dbType] || "bar";
};
