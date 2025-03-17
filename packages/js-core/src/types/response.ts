export type TResponseData = Record<string, string | number | string[]>;

export type TResponseVariables = Record<string, string | number>;

export type TResponseTtc = Record<string, number>;

export interface TResponseUpdate {
  finished: boolean;
  data: TResponseData;
  language?: string;
  variables?: TResponseVariables;
  ttc?: TResponseTtc;
  meta?: {
    url?: string;
    source?: string;
    action?: string;
  };
  displayId?: string | null;
  endingId?: string | null;
}
