export interface TaxonomyKeyword {
  id: string;
  name: string;
  count: number;
  parentId?: string;
}

export interface TaxonomyTheme {
  id: string;
  label: string;
  count: number;
  color: "red" | "orange" | "yellow" | "green" | "slate";
}

export interface TaxonomyThemeItem {
  id: string;
  label: string;
  count: number;
  icon?: "warning" | "wrench" | "message-circle" | "lightbulb";
  children?: TaxonomyThemeItem[];
}

export interface TaxonomyDetail {
  keywordId: string;
  keywordName: string;
  count: number;
  description: string;
  themes: TaxonomyTheme[];
  themeItems: TaxonomyThemeItem[];
}
