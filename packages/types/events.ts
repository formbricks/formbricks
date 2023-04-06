import { MatchType } from "./js";

export interface NoCodeConfig {
  type: "innerHtml" | "pageUrl" | "cssSelector";
  pageUrl?: { value: string; rule: MatchType };
  innerHtml?: { value: string };
  cssSelector?: { value: string };
}

export interface Event {
  name: string;
  description: string;
  noCodeConfig: NoCodeConfig;
  type: string;
}
