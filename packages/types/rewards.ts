import { z } from "zod";

export const ZBaseReward = z.object({
  chainId: z.number(),
  contractAddress: z.string(),
  amount: z.string(),
  decimals: z.number(),
  name: z.string(),
  logo: z.string(),
});

export type TBaseReward = z.infer<typeof ZBaseReward>;
