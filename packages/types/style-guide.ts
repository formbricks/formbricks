import { z } from "zod";

export const ZStyleGuideLogo = z.object({
  url: z.string().url().optional(),
  altText: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export type StyleGuideLogo = z.infer<typeof ZStyleGuideLogo>;

export const ZStyleGuideCustomColors = z.record(z.string()).optional();
export type StyleGuideCustomColors = z.infer<typeof ZStyleGuideCustomColors>;

export const ZStyleGuideWorkspaceConfig = z.record(z.boolean()).optional();
export type StyleGuideWorkspaceConfig = z.infer<typeof ZStyleGuideWorkspaceConfig>;

export const ZStyleGuideBase = z.object({
  name: z.string().min(1).max(255),
  brandColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  borderRadius: z.string().optional(),
  fontSize: z.string().optional(),
  fontFamily: z.string().optional(),
  version: z.string().optional(),
  authors: z.string().optional(),
  externalDocumentation: z.string().url().optional(),
  logo: ZStyleGuideLogo.optional(),
  customColors: ZStyleGuideCustomColors,
});

export const ZStyleGuideCreate = ZStyleGuideBase.extend({
  organizationId: z.string(),
});

export const ZStyleGuideUpdate = ZStyleGuideBase.partial().extend({
  workspaceConfig: ZStyleGuideWorkspaceConfig,
  isActive: z.boolean().optional(),
});

export const ZStyleGuide = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  organizationId: z.string(),
  name: z.string(),
  brandColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  borderRadius: z.string().nullable(),
  fontSize: z.string().nullable(),
  fontFamily: z.string().nullable(),
  version: z.string().nullable(),
  authors: z.string().nullable(),
  externalDocumentation: z.string().nullable(),
  logo: ZStyleGuideLogo.nullable(),
  customColors: ZStyleGuideCustomColors,
  workspaceConfig: ZStyleGuideWorkspaceConfig,
  isActive: z.boolean(),
});

export type StyleGuide = z.infer<typeof ZStyleGuide>;
export type StyleGuideCreate = z.infer<typeof ZStyleGuideCreate>;
export type StyleGuideUpdate = z.infer<typeof ZStyleGuideUpdate>;
