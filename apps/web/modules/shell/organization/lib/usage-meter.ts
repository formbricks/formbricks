export type TUsageMeterTone = "ok" | "warning" | "over";

export interface TUsageMeter {
  current: number;
  /** `null` means the plan sets no limit for this metric. */
  limit: number | null;
  /** Share of the limit used, from 0 to 1; 0 when there is no limit. */
  ratio: number;
  tone: TUsageMeterTone;
}

/** The bar turns amber from this share of the limit. */
const WARNING_RATIO = 0.9;

export const getUsageMeter = (current: number, limit: number | null): TUsageMeter => {
  if (limit === null) {
    return { current, limit, ratio: 0, tone: "ok" };
  }

  let ratio = 0;
  if (limit > 0) ratio = Math.min(current / limit, 1);
  else if (current > 0) ratio = 1;

  let tone: TUsageMeterTone = "ok";
  if (current > limit) tone = "over";
  else if (ratio >= WARNING_RATIO) tone = "warning";

  return { current, limit, ratio, tone };
};

export const USAGE_METER_BAR_CLASS: Record<TUsageMeterTone, string> = {
  ok: "bg-brand-dark",
  warning: "bg-amber-500",
  over: "bg-red-500",
};
