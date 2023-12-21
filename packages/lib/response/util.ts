import "server-only";

import { TResponseTtc } from "@formbricks/types/responses";

export function calculateTtcTotal(ttc: TResponseTtc) {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
}
