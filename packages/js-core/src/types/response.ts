export type TResponseData = Record<string, string | number | string[]>;

// A calculated true/false field (ENG-6973) holds a real boolean.
export type TResponseVariables = Record<string, string | number | boolean>;

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
