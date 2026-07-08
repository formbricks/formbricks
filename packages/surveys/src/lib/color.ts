// Re-exported from @formbricks/types so the color/WCAG helpers are defined once and shared
// with the web app (apps/web) instead of duplicated per package. These are pure functions,
// so tree-shaking keeps only what the renderer actually uses out of the widget bundle.
export * from "@formbricks/types/colors";
