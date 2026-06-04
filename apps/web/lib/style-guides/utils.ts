import { prisma } from "@formbricks/database";
import { StyleGuide } from "@formbricks/types/style-guide";

export interface AppliedStyleGuide {
  brandColor?: string;
  accentColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontFamily?: string;
  customColors?: Record<string, string>;
  logo?: {
    url?: string;
    altText?: string;
    width?: number;
    height?: number;
  };
}

export async function getActiveStyleGuideForWorkspace(
  workspaceId: string
): Promise<AppliedStyleGuide | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { activeStyleGuideId: true },
  });

  if (!workspace?.activeStyleGuideId) {
    return null;
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: workspace.activeStyleGuideId },
    select: {
      brandColor: true,
      accentColor: true,
      borderRadius: true,
      fontSize: true,
      fontFamily: true,
      customColors: true,
      logo: true,
    },
  });

  if (!styleGuide) {
    return null;
  }

  return {
    brandColor: styleGuide.brandColor ?? undefined,
    accentColor: styleGuide.accentColor ?? undefined,
    borderRadius: styleGuide.borderRadius ?? undefined,
    fontSize: styleGuide.fontSize ?? undefined,
    fontFamily: styleGuide.fontFamily ?? undefined,
    customColors: styleGuide.customColors as Record<string, string> | undefined,
    logo: styleGuide.logo as AppliedStyleGuide["logo"],
  };
}

export function applyStyleGuideToSurveyTheme(styleGuide: AppliedStyleGuide): Record<string, any> {
  return {
    allowStyleOverwrite: true,
    brandColor: styleGuide.brandColor,
    accentColor: styleGuide.accentColor,
    questionTextColor: "#000000",
    inputColor: "#ffffff",
    inputTextColor: "#000000",
    inputBorderColor: "#e5e7eb",
    cardBackgroundColor: "#ffffff",
    cardBorderColor: "#e5e7eb",
    cardTextColor: "#000000",
    buttonTextColor: "#ffffff",
    buttonBackgroundColor: styleGuide.brandColor,
    buttonBorderColor: styleGuide.brandColor,
    borders: styleGuide.borderRadius ? `rounded-[${styleGuide.borderRadius}]` : "rounded",
    fontFamily: styleGuide.fontFamily,
    fontSize: styleGuide.fontSize,
    customColors: styleGuide.customColors,
  };
}

export function convertStyleGuideToCSS(styleGuide: AppliedStyleGuide): string {
  const cssVars: string[] = [];

  if (styleGuide.brandColor) {
    cssVars.push(`--brand-color: ${styleGuide.brandColor};`);
  }
  if (styleGuide.accentColor) {
    cssVars.push(`--accent-color: ${styleGuide.accentColor};`);
  }
  if (styleGuide.borderRadius) {
    cssVars.push(`--border-radius: ${styleGuide.borderRadius};`);
  }
  if (styleGuide.fontSize) {
    cssVars.push(`--font-size: ${styleGuide.fontSize};`);
  }
  if (styleGuide.fontFamily) {
    cssVars.push(`--font-family: ${styleGuide.fontFamily};`);
  }

  if (styleGuide.customColors) {
    Object.entries(styleGuide.customColors).forEach(([key, value]) => {
      cssVars.push(`--${key}: ${value};`);
    });
  }

  return `:root { ${cssVars.join(" ")} }`;
}
