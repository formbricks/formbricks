import { z } from "zod";

const ZBadgeOptionSchema = z.object({
  text: z.string(),
  type: z.enum(["warning", "success", "error", "gray"]),
});

const ZBadgePropsSchema = z.object({
  text: z.string().optional(),
  type: z.enum(["warning", "success", "error", "gray"]).optional(),
  options: z.array(ZBadgeOptionSchema).optional(),
  selectedIndex: z.number().optional(),
  onChange: z.function().args(z.number()).returns(z.void()).optional(),
  size: z.enum(["tiny", "normal", "large"]),
  className: z.string().optional(),
  isLoading: z.boolean().optional(),
});

export type TBadgeOption = z.infer<typeof ZBadgeOptionSchema>;
export type TBadgeProps = z.infer<typeof ZBadgePropsSchema>;
