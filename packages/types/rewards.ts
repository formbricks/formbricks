import { z } from "zod";

export const ZBaseReward = z.object({
  chainId: z.number().nullish(),
  contractAddress: z.string().nullish(),
  amount: z.string().nullish(),
  decimals: z.number().nullish(),
  name: z.string().nullish(),
  symbol: z.string().nullish(),
  logo: z.string().nullish(),
});

export type TBaseReward = z.infer<typeof ZBaseReward>;
